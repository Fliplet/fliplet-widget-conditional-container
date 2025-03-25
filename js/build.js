"use strict";

// Self-executing function to contain widget code
(function() {
  Fliplet.ConditionalContainer = Fliplet.ConditionalContainer || {};
  
  const conditionalContainerInstances = {};
  // Map to store condition results for each container instance
  const containerConditionResults = {};
  // Map to track processed container IDs to avoid duplicate processing
  const processedContainerIds = {};
  // Map to store container elements by ID for batch processing
  const containerElementsByIds = {};
  
  // Enable verbose logging for debugging
  const DEBUG = true;
  const logDebug = (message, data) => {
    if (DEBUG) {
      console.group(`[Conditional Container] ${message}`);
      if (data !== undefined) {
        console.log(data);
      }
      console.trace(); // Add stack trace for easier debugging
      console.groupEnd();
    }
  };

  Fliplet().then(function() {
    logDebug('Fliplet initialized');
    
    // Register the widget instance
    Fliplet.Widget.instance('conditional-container', function(data, parent) {
      // Get container element
      const container = this;
      
      // Generate a unique identifier for this container instance
      // This handles cases where multiple instances of the same conditional container
      // appear in a list repeater with the same ID
      const rowDataId = container.closest('[data-fl-list-item-id]')?.getAttribute('data-fl-list-item-id');
      
      // Create a unique container instance ID that includes the row ID if in a repeater
      const uniqueId = rowDataId ? `${data.id}_${rowDataId}` : data.id;
      
      logDebug('Widget instance created', { 
        id: data.id, 
        uniqueId: uniqueId,
        rowDataId: rowDataId || 'not in repeater',
        data 
      });
      
      // Find and process template
      const emptyTemplate = container.querySelector('template[name="empty"]');
      const templateContent = emptyTemplate ? emptyTemplate.innerHTML : null;
      
      logDebug('Container and template', { 
        container: container ? 'Found' : 'Not found',
        template: templateContent ? 'Found' : 'Not found',
        rowContext: rowDataId ? `In row ${rowDataId}` : 'Not in repeater'
      });
      
      // Remove template from DOM
      if (emptyTemplate) {
        emptyTemplate.remove();
      }
      
      // Add this container to the collection of containers with the same ID
      if (!containerElementsByIds[data.id]) {
        containerElementsByIds[data.id] = [];
      }
      containerElementsByIds[data.id].push({
        element: container,
        uniqueId: uniqueId,
        rowDataId: rowDataId
      });
      
      // Create instance container
      const containerPromise = new Promise((resolve) => {
        const instance = {
          id: data.id,
          uniqueId: uniqueId,
          uuid: data.uuid,
          parent,
          rowDataId,
          element: container
        };
        
        // Initialize condition state for this container using the unique ID
        containerConditionResults[uniqueId] = false;
        
        // Handle interact/edit mode
        if (Fliplet.Env.get('interact')) {
          logDebug('Running in interact/edit mode');
          
          if (Fliplet.Interact) {
            logDebug('Initializing Fliplet.Interact.ViewContainer');
            new Fliplet.Interact.ViewContainer(container, {
              placeholder: templateContent
            });
          }
          
          // Initialize children components inside the container
          logDebug('Initializing children in edit mode');
          Fliplet.Widget.initializeChildren(container, instance);
          resolve(instance);
          return;
        }
        
        // Runtime code
        const conditions = data.conditions;
        // Check if useAsConditionalContainer checkbox is checked (handles both array and boolean format)
        const useAsConditionalContainer = Array.isArray(data.useAsConditionalContainer) 
          ? data.useAsConditionalContainer.includes(true) 
          : !!data.useAsConditionalContainer;
        const isPreview = Fliplet.Env.get('preview');
        
        logDebug('Runtime configuration', { 
          conditions,
          useAsConditionalContainer,
          originalUseAsConditionalContainer: data.useAsConditionalContainer,
          isPreview,
          containerId: data.id,
          uniqueId: uniqueId,
          inRepeater: !!rowDataId
        });
        
        if (!useAsConditionalContainer) {
          // If not used as conditional container, just initialize children
          logDebug('Not used as conditional container, initializing children');
          Fliplet.Widget.initializeChildren(container, instance).then(() => {
            logDebug('Children initialized (non-conditional mode)');
            resolve(instance);
          });
          return;
        }
        
        // By default container is hidden
        logDebug('Adding hidden class to container');
        container.classList.add('hidden');
        
        // Check if this container ID has already been processed
        // This helps us avoid redundant condition checking for containers
        // with the same ID in the same context (non-repeater)
        if (!rowDataId && processedContainerIds[data.id]) {
          logDebug(`Container ID ${data.id} has already been processed, using cached result`);
          
          // Use cached condition result
          const conditionResult = containerConditionResults[data.id];
          
          if (conditionResult) {
            // Show this container
            logDebug('Using cached result: Showing container', { uniqueId });
            container.classList.remove('hidden');
            Fliplet.Widget.initializeChildren(container, instance).then(() => {
              resolve(instance);
            });
          } else {
            // Keep container hidden
            logDebug('Using cached result: Container remains hidden', { uniqueId });
            resolve(instance);
          }
          return;
        }
        
        // Check conditions - only process once per container ID in non-repeater context
        // In repeater context, each row's container needs to be processed separately
        if (!rowDataId) {
          // Mark this container ID as processed
          processedContainerIds[data.id] = true;
        }
        
        // Check conditions
        logDebug('Checking conditions');
        checkConditions(container, data, isPreview, instance, uniqueId, rowDataId).then((result) => {
          logDebug('Conditions checked, resolving instance');
          
          // If condition passed, show all containers with the same ID
          if (result && !rowDataId) {
            logDebug('Condition passed, showing all containers with ID: ' + data.id);
            
            // Show all containers with this ID
            const containersToShow = containerElementsByIds[data.id] || [];
            containersToShow.forEach(containerInfo => {
              const containerEl = containerInfo.element;
              const containerId = containerInfo.uniqueId;
              
              logDebug('Showing container', { containerId });
              containerEl.classList.remove('hidden');
              
              // Store result for this container
              containerConditionResults[containerId] = true;
              
              // Initialize children for each container
              const containerInstance = {
                id: data.id,
                uniqueId: containerId,
                uuid: data.uuid,
                parent,
                rowDataId: containerInfo.rowDataId,
                element: containerEl
              };
              
              Fliplet.Widget.initializeChildren(containerEl, containerInstance);
            });
          }
          
          resolve(instance);
        });
      });
      
      // Store using the unique ID as well as the normal ID
      containerPromise.id = data.id;
      containerPromise.uniqueId = uniqueId;
      containerPromise.rowDataId = rowDataId;
      
      // Store the instance with both regular ID and unique ID
      conditionalContainerInstances[uniqueId] = containerPromise;
      
      // Maintain backward compatibility by also storing with the original ID
      // but only for containers not in repeaters to avoid conflicts
      if (!rowDataId) {
        conditionalContainerInstances[data.id] = containerPromise;
      }
    }, {
      supportsDynamicContext: true
    });
  });
  
  /**
   * Checks conditions to determine container visibility
   * @param {HTMLElement} container - The container element
   * @param {Object} data - The widget instance data
   * @param {Boolean} isPreview - Whether we're in preview mode
   * @param {Object} instance - The widget instance
   * @param {String|Number} uniqueId - The unique ID for this container instance
   * @param {String|Number} rowDataId - The row ID if this container is in a repeater
   * @returns {Promise<Boolean>} Promise resolving to whether the condition was met
   */
  async function checkConditions(container, data, isPreview, instance, uniqueId, rowDataId) {
    logDebug('checkConditions started', { 
      containerId: data.id, 
      uniqueId: uniqueId,
      rowDataId: rowDataId || 'not in repeater'
    });
    
    const userNotLoggedMessage = 'User is not logged in';
    let result = false;
    
    try {
      // Check user session and evaluate conditions
      logDebug('Getting user session');
      const session = await Fliplet.Session.get();
      
      logDebug('Session data', { 
        sessionExists: !!session,
        hasEntries: !!(session && session.entries),
        hasDataSource: !!(session && session.entries && session.entries.dataSource)
      });
      
      if (!session || !session.entries || !session.entries.dataSource) {
        if (isPreview) {
          logDebug('User not logged in (preview mode)');
          Fliplet.UI.Toast(userNotLoggedMessage);
        }
        return false;
      }
      
      const user = session.entries.dataSource.data;
      logDebug('User data', user);
      
      // If in repeater context and row data exists, use that instead of user data
      // Check if we have access to the row data for this repeater item
      let rowData = null;
      if (rowDataId) {
        // Try to get row data from list component
        try {
          const listItem = container.closest(`[data-fl-list-item-id="${rowDataId}"]`);
          const list = listItem.closest('[data-fl-list-data]');
          
          if (list) {
            const listData = JSON.parse(list.getAttribute('data-fl-list-data') || '[]');
            rowData = listData.find(item => item.id.toString() === rowDataId.toString());
            
            if (rowData) {
              logDebug('Found row data for item in repeater', { 
                rowDataId, 
                rowData,
                containerId: data.id,
                uniqueId
              });
            }
          }
        } catch (err) {
          console.error('Error getting row data:', err);
          logDebug('Error getting row data for repeater item', { 
            error: err.message,
            rowDataId
          });
        }
      }
      
      // Use row data if available, otherwise fall back to user data
      const contextData = rowData || user;
      
      if (data.conditions && data.conditions.length) {
        logDebug(`Processing ${data.conditions.length} conditions for container ${uniqueId}`, {
          usingRowData: !!rowData,
          contextDataType: rowData ? 'row data' : 'user data'
        });
        
        for (const condition of data.conditions) {
          const dataKey = condition['user_key'];
          
          logDebug('Checking condition', { 
            condition,
            keyExists: contextData.hasOwnProperty(dataKey),
            keyValue: contextData[dataKey],
            containerId: data.id,
            uniqueId
          });
          
          if (!contextData.hasOwnProperty(dataKey)) {
            if (isPreview) {
              const message = rowData 
                ? `Row data doesn't contain key: ${dataKey}`
                : `User doesn't contain key: ${dataKey}`;
              
              logDebug(message);
              Fliplet.UI.Toast(message);
            }
            continue;
          }
          
          const logic = condition.logic;
          let expression;
          
          if (logic !== 'contains') {
            expression = `"${contextData[dataKey]}"`;
            
            if (logic === 'equal') {
              expression += ` === "${condition.user_value}"`;
            } else if (logic === 'not-equal') {
              expression += ` !== "${condition.user_value}"`;
            }
            
            logDebug('Evaluating expression', { expression, logic, uniqueId });
            result = evaluate(condition, expression, logic === 'not-equal');
            logDebug('Expression result', { result, uniqueId });
          } else {
            const keyType = getType(contextData[dataKey]);
            logDebug('Contains logic, key type', { keyType, uniqueId });
            
            if (keyType === 'array') {
              logDebug('Processing array type', { uniqueId });
              result = isConditionIncluded(contextData[dataKey], condition);
              logDebug('Array inclusion check result', { result, uniqueId });
            } else if (keyType === 'string') {
              // check if string can be parsed into JSON array
              const parsedType = getParsedType(contextData[dataKey]);
              logDebug('String parsed type', { parsedType, uniqueId });
              
              if (parsedType === 'array') {
                logDebug('Processing parsed array', { uniqueId });
                const currentArray = JSON.parse(contextData[dataKey]);
                result = isConditionIncluded(currentArray, condition);
                logDebug('Parsed array inclusion check result', { result, uniqueId });
              } else {
                logDebug('Processing string with comma separation', { uniqueId });
                expression = contextData[dataKey]
                  .split(',')
                  .map(el => el.trim())
                  .includes(decodeHTMLEntities(condition.user_value));
                result = evaluate(condition, expression);
                logDebug('String contains check result', { result, uniqueId });
              }
            } else {
              // other type but array or string
              logDebug('Processing other type with indexOf', { uniqueId });
              expression = `"${contextData[dataKey]}".indexOf("${condition.user_value}") > -1`;
              result = evaluate(condition, expression);
              logDebug('indexOf check result', { result, uniqueId });
            }
          }
          
          // If we found a matching condition, no need to check others
          if (result) {
            logDebug('Matching condition found, breaking loop', { uniqueId });
            break;
          }
        }
      }
      
      // Store the result for this specific container using its unique ID
      containerConditionResults[uniqueId] = result;
      
      // For non-repeater containers, also store the result by container ID
      // This allows us to reuse the result for other instances of the same container
      if (!rowDataId) {
        containerConditionResults[data.id] = result;
      }
      
      logDebug('Final condition result', { 
        result, 
        uniqueId,
        nonRepeaterResult: !rowDataId ? result : 'N/A',
        allContainerResults: containerConditionResults
      });
      
      return result;
    } catch (error) {
      console.error('Error checking conditions:', error);
      logDebug('Exception in checkConditions', { 
        error: error.message, 
        stack: error.stack,
        uniqueId
      });
      return false;
    }
  }
  
  /**
   * Helper function to determine element type
   * @param {*} elem - Element to check
   * @returns {String|Boolean} Type of element or false
   */
  function getType(elem) {
    if (Array.isArray(elem)) {
      return 'array';
    }
    
    return typeof elem === 'string' ? 'string' : false;
  }
  
  /**
   * Helper function to decode HTML entities
   * @param {String} str - String to decode
   * @returns {String} Decoded string
   */
  function decodeHTMLEntities(str) {
    const temp = document.createElement('div');
    temp.style.display = 'none';
    temp.innerHTML = str;
    
    return temp.textContent || temp.innerText;
  }
  
  /**
   * Helper function to determine parsed type
   * @param {String} elem - Element to parse
   * @returns {String|Boolean} Type of parsed element or false
   */
  function getParsedType(elem) {
    try {
      const parsedValue = JSON.parse(elem);
      
      if (Array.isArray(parsedValue)) {
        return 'array';
      }
      
      return false;
    } catch (error) {
      return 'string';
    }
  }
  
  /**
   * Helper function to evaluate expressions
   * @param {Object} condition - Condition object
   * @param {String} expression - Expression to evaluate
   * @param {Boolean} notEqual - Whether this is a not-equal condition
   * @returns {Boolean} Result of evaluation
   */
  function evaluate(condition, expression, notEqual) {
    try {
      const evalResult = eval(expression);
      logDebug('Expression evaluation', { expression, result: evalResult });
      
      if (evalResult) {
        return condition['visibility'] !== 'hide';
      }
      
      if (notEqual) {
        return condition['visibility'] === 'hide';
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating condition:', error);
      logDebug('Expression evaluation error', { expression, error: error.message });
      return false;
    }
  }
  
  /**
   * Helper function to check if condition is included in array
   * @param {Array} array - Array to check
   * @param {Object} condition - Condition object
   * @returns {Boolean} Whether condition is included
   */
  function isConditionIncluded(array, condition) {
    const userValue = condition.user_value;
    
    logDebug('Array inclusion check', { 
      array, 
      userValue,
      includes: array.includes(userValue),
      numericMatch: array.some(value => typeof value === 'number' && value === Number(userValue))
    });
    
    if (array.includes(userValue) || array.some(value => typeof value === 'number' && value === Number(userValue))) {
      return condition.visibility !== 'hide';
    }
    
    return false;
  }
  
  /**
   * Get a conditional container instance by ID
   * @param {Number|String|Object} filter - Filter by ID or properties
   * @param {Object} options - Additional options for retrieval
   * @returns {Promise} Promise resolving to the container instance
   */
  Fliplet.ConditionalContainer.get = async function(filter, options = {}) {
    logDebug('get() called', { filter, options });
    
    if (typeof filter === 'number' || typeof filter === 'string') {
      filter = { id: +filter };
    }

    await Fliplet();
 
    const containers = await Promise.all(Object.values(conditionalContainerInstances));
    logDebug(`Found ${containers.length} container instances`);
    
    const objectMatch = (obj, filter) => Object.keys(filter).every(key => obj[key] === filter[key]);
    const container = filter ? containers.find(c => objectMatch(c, filter)) : containers[0];

    // Containers can render over time, so we need to retry later in the process
    if (!container) {
      logDebug('Container not found, will retry', { timeoutMs: options.ts });
      
      if (options.ts > 5000) {
        logDebug('Max retries exceeded');
        return Promise.reject(`Conditional container instance not found after ${Math.ceil(options.ts / 1000)} seconds.`);
      }

      if (options.ts === undefined) {
        options.ts = 10;
      } else {
        options.ts *= 1.5; // increase ts by 50% every time
      }

      await new Promise(resolve => setTimeout(resolve, options.ts)); // sleep

      return Fliplet.ConditionalContainer.get(filter, options);
    }

    logDebug('Container found', { 
      containerId: container.id,
      uniqueId: container.uniqueId,
      inRepeaterRow: container.rowDataId ? true : false 
    });
    return container;
  };

  /**
   * Get all conditional container instances
   * @param {Object|Function} filter - Filter by properties
   * @returns {Promise} Promise resolving to container instances
   */
  Fliplet.ConditionalContainer.getAll = function(filter) {
    logDebug('getAll() called', { filter });
    
    if (typeof filter !== 'object' && typeof filter !== 'function') {
      filter = { id: filter };
    }

    return Fliplet().then(function() {
      return Promise.all(Object.values(conditionalContainerInstances)).then(function(containers) {
        logDebug(`Found ${containers.length} container instances`);
        
        if (typeof filter === 'undefined') {
          return containers;
        }

        const filtered = containers.filter(container => {
          if (typeof filter === 'function') {
            return filter(container);
          }
          
          return Object.keys(filter).every(key => container[key] === filter[key]);
        });
        
        logDebug(`Filtered to ${filtered.length} container instances`);
        return filtered;
      });
    });
  };
  
  /**
   * Get condition result for a specific container
   * @param {Number|String} containerId - ID of the container
   * @param {String|Number} rowId - Optional row ID for containers in repeaters
   * @returns {Boolean} The condition result for the container
   */
  Fliplet.ConditionalContainer.getConditionResult = function(containerId, rowId) {
    // If rowId is provided, use the combined uniqueId
    const lookupId = rowId ? `${containerId}_${rowId}` : containerId;
    return containerConditionResults[lookupId] || false;
  };
})();
