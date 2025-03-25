"use strict";

// Self-executing function to contain widget code
(function() {
  Fliplet.ConditionalContainer = Fliplet.ConditionalContainer || {};
  
  // Track container instances and condition states
  const containerInstances = {};
  const conditionResults = {};
  const processedIds = {};
  const containersByIds = {};
  
  // Configure logging - enable in dev, disable in production
  const DEBUG = Fliplet.Env.get('development') || false;
  const log = (message, data) => {
    if (!DEBUG) return;
    console.group(`[Conditional Container] ${message}`);
    if (data !== undefined) console.log(data);
    console.groupEnd();
  };

  (async () => {
    await Fliplet();
    log('Fliplet initialized');
    
    // Register the widget instance
    Fliplet.Widget.instance('conditional-container', async function(data, parent) {
      const container = this;
      const containerId = data.id;
      
      log('Widget instance created', { id: containerId });
      
      // Process template
      const emptyTemplate = container.querySelector('template[name="empty"]');
      const templateContent = emptyTemplate?.innerHTML;
      emptyTemplate?.remove();
      
      // Track all containers with the same ID
      if (!containersByIds[containerId]) {
        containersByIds[containerId] = [];
      }
      containersByIds[containerId].push({ element: container });
      
      // Create instance container
      const instance = {
        id: containerId,
        uuid: data.uuid,
        parent,
        element: container
      };
      
      // Handle interact/edit mode
      if (Fliplet.Env.get('interact')) {
        log('Running in interact/edit mode');
        
        if (Fliplet.Interact) {
          new Fliplet.Interact.ViewContainer(container, {
            placeholder: templateContent
          });
        }
        
        await Fliplet.Widget.initializeChildren(container, instance);
        return instance;
      }
      
      // Runtime mode
      const useAsConditional = Array.isArray(data.useAsConditionalContainer) 
        ? data.useAsConditionalContainer.includes(true) 
        : !!data.useAsConditionalContainer;
      
      log('Runtime configuration', { 
        useAsConditional,
        hasConditions: Array.isArray(data.conditions) && data.conditions.length > 0,
        containerId
      });
      
      // If not used as conditional container, initialize children directly
      if (!useAsConditional) {
        log('Not using conditional behavior');
        await Fliplet.Widget.initializeChildren(container, instance);
        return instance;
      }
      
      // Initially hide container
      container.classList.add('hidden');
      
      // Use cached result if this container ID has already been processed 
      if (processedIds[containerId]) {
        log(`Using cached result for container ${containerId}`);
        
        if (conditionResults[containerId]) {
          container.classList.remove('hidden');
          await Fliplet.Widget.initializeChildren(container, instance);
        }
        
        return instance;
      }
      
      // Mark as processed to avoid redundant condition checking
      processedIds[containerId] = true;
      
      // Evaluate conditions
      const result = await evaluateConditions(data);
      log(`Condition evaluation result: ${result}`, { containerId });
      
      // Store result for future reference
      conditionResults[containerId] = result;
      
      if (result) {
        // Show all containers with the same ID
        const containersToUpdate = containersByIds[containerId] || [];
        
        for (const info of containersToUpdate) {
          const el = info.element;
          
          log('Showing container', { id: containerId });
          el.classList.remove('hidden');
          
          // Create instance for each container
          const containerInstance = {
            id: containerId,
            uuid: data.uuid,
            parent,
            element: el
          };
          
          await Fliplet.Widget.initializeChildren(el, containerInstance);
        }
      }
      
      return instance;
    }, {
      supportsDynamicContext: true
    });
  })();
  
  /**
   * Evaluates container conditions against user data
   * @param {Object} data - Container data
   * @returns {Promise<Boolean>} Whether conditions are met
   */
  async function evaluateConditions(data) {
    log('Evaluating conditions');
    
    try {
      // Get user session
      const session = await Fliplet.Session.get();
      
      if (!session?.entries?.dataSource) {
        log('User not logged in');
        if (Fliplet.Env.get('preview')) {
          Fliplet.UI.Toast('User is not logged in');
        }
        return false;
      }
      
      const user = session.entries.dataSource.data;
      
      // If no conditions defined, return false
      if (!Array.isArray(data.conditions) || !data.conditions.length) {
        return false;
      }
      
      // Check each condition
      for (const condition of data.conditions) {
        const dataKey = condition.user_key;
        
        if (!user.hasOwnProperty(dataKey)) {
          if (Fliplet.Env.get('preview')) {
            Fliplet.UI.Toast(`User doesn't contain key: ${dataKey}`);
          }
          continue;
        }
        
        const userData = user[dataKey];
        const logic = condition.logic;
        const value = condition.user_value;
        
        let matches = false;
        
        // Evaluate based on logic type
        if (logic === 'equal') {
          matches = String(userData) === String(value);
        } else if (logic === 'not-equal') {
          matches = String(userData) !== String(value);
        } else if (logic === 'contains') {
          matches = checkContains(userData, value);
        }
        
        const result = logic === 'not-equal' 
          ? (matches ? condition.visibility !== 'hide' : condition.visibility === 'hide')
          : (matches ? condition.visibility !== 'hide' : false);
        
        // If condition is met, no need to check others
        if (result) {
          log('Matching condition found', { condition });
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating conditions:', error);
      return false;
    }
  }
  
  /**
   * Checks if a value is contained in various data types
   * @param {*} data - The data to check
   * @param {*} value - The value to look for
   * @returns {Boolean} - Whether the value is contained
   */
  function checkContains(data, value) {
    // Handle array data
    if (Array.isArray(data)) {
      return data.includes(value) || 
        data.some(item => typeof item === 'number' && item === Number(value));
    }
    
    // Handle string data that might be JSON
    if (typeof data === 'string') {
      try {
        // Try parsing as JSON array
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
          return parsed.includes(value) || 
            parsed.some(item => typeof item === 'number' && item === Number(value));
        }
      } catch (e) {
        // Not JSON, treat as comma-separated string
        return data.split(',')
          .map(item => item.trim())
          .includes(decodeHTMLEntities(value));
      }
    }
    
    // Default case: convert to string and check includes
    return String(data).includes(String(value));
  }
  
  /**
   * Helper function to decode HTML entities
   * @param {String} str - String to decode
   * @returns {String} Decoded string
   */
  function decodeHTMLEntities(str) {
    const temp = document.createElement('div');
    temp.innerHTML = str;
    return temp.textContent || temp.innerText;
  }
  
  /**
   * Get a conditional container instance by ID
   * @param {Number|String|Object} filter - Filter by ID or properties
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Container instance
   */
  Fliplet.ConditionalContainer.get = async function(filter, options = {}) {
    const idFilter = typeof filter === 'number' || typeof filter === 'string'
      ? { id: +filter }
      : filter;

    await Fliplet();
 
    const containers = await Promise.all(Object.values(containerInstances));
    const container = idFilter 
      ? containers.find(c => Object.keys(idFilter).every(key => c[key] === idFilter[key]))
      : containers[0];

    // Handle retry for async container initialization
    if (!container) {
      // Stop retrying after 5 seconds
      if (options.ts > 5000) {
        throw new Error(`Conditional container not found after ${Math.ceil(options.ts / 1000)} seconds.`);
      }

      // Exponential backoff
      const delay = options.ts ? options.ts * 1.5 : 10;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      return Fliplet.ConditionalContainer.get(filter, { ...options, ts: delay });
    }

    return container;
  };

  /**
   * Get all conditional container instances
   * @param {Object|Function} filter - Filter by properties
   * @returns {Promise<Array>} Container instances
   */
  Fliplet.ConditionalContainer.getAll = async function(filter) {
    if (typeof filter !== 'object' && typeof filter !== 'function') {
      filter = { id: filter };
    }

    await Fliplet();
    const containers = await Promise.all(Object.values(containerInstances));
    
    if (!filter) return containers;

    return containers.filter(container => {
      if (typeof filter === 'function') {
        return filter(container);
      }
      
      return Object.keys(filter).every(key => container[key] === filter[key]);
    });
  };
  
  /**
   * Get condition result for a specific container
   * @param {Number|String} containerId - ID of the container
   * @returns {Boolean} The condition result for the container
   */
  Fliplet.ConditionalContainer.getConditionResult = function(containerId) {
    return conditionResults[containerId] || false;
  };
})();
