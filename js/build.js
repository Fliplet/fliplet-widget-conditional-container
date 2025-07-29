/**
 * Fliplet Conditional Container Widget
 * ====================================
 *
 * PURPOSE:
 * Implements a container component that shows or hides content based on user-defined conditions
 * tied to user session data. This allows for dynamic UI based on user attributes or permissions.
 *
 * CORE COMPONENTS:
 * - Widget Registration: Registers with Fliplet widget system with dynamic context support
 * - Condition Evaluation: Processes logical conditions (equal, not-equal, contains) against user data
 * - Container Management: Tracks and updates multiple container instances with the same ID
 * - Content Visibility: Shows/hides content based on condition results
 *
 * DATA STRUCTURES:
 * - containerInstances: Tracks widget instances by ID for API access
 * - conditionResults: Stores evaluation results by container ID to avoid redundant evaluations
 * - processedIds: Tracks which containers have been evaluated to prevent duplicate processing
 * - containersByIds: Groups container elements by ID for concurrent updates
 *
 * LIFECYCLE:
 * 1. Widget initialization and template processing
 * 2. Condition evaluation based on user session data
 * 3. Container visibility management based on evaluation results
 * 4. Children components initialization after visibility is determined
 *
 * PUBLIC API:
 * - Fliplet.ConditionalContainer.get: Retrieves specific container instance
 * - Fliplet.ConditionalContainer.getAll: Retrieves multiple container instances
 * - Fliplet.ConditionalContainer.getConditionResult: Gets condition result for a container
 *
 * MODES:
 * - Edit/Interact Mode: Shows container with placeholder for configuration
 * - Runtime Mode: Evaluates conditions and shows/hides content accordingly
 * - Conditional Mode Toggle: Can be disabled to always show content regardless of conditions
 */

"use strict";

// Self-executing function to contain widget code
(function() {
  Fliplet.ConditionalContainer = Fliplet.ConditionalContainer || {};

  // Track container instances and condition states
  const containerInstances = {};
  const conditionResults = {};
  const processedIds = {};
  const containersByIds = {};

  // Initialize Fliplet and register widget
  (async function() {
    await Fliplet();

    // Register the widget instance
    Fliplet.Widget.instance('conditional-container', function(data, parent) {
      const container = this;
      const containerId = data.id;

      // Process template
      const emptyTemplate = container.querySelector('template[name="empty"]');
      const templateContent = emptyTemplate ? emptyTemplate.innerHTML : '';
      if (emptyTemplate) {
        emptyTemplate.remove();
      }

      // Track all containers with the same ID
      if (!containersByIds[containerId]) {
        containersByIds[containerId] = [];
      }

      // Store the container element with parent context
      containersByIds[containerId].push({
        element: container,
        initialized: false,
        parentContext: parent
      });

      // Create instance promise - keep promise structure for widget system compatibility
      const instancePromise = new Promise(async (resolve) => {
        const instance = {
          id: containerId,
          uuid: data.uuid,
          parent,
          element: container
        };

        try {
          // Handle interact/edit mode
          if (Fliplet.Env.get('interact')) {
            if (Fliplet.Interact) {
              new Fliplet.Interact.ViewContainer(container, {
                placeholder: templateContent
              });
            }

            await Fliplet.Widget.initializeChildren(container, instance);
            resolve(instance);
            return;
          }

          // Determine if container should use conditional behavior
          const useAsConditional = isConditionalMode(data.useAsConditionalContainer);

          // If not used as conditional container, initialize children directly
          if (!useAsConditional) {
            await Fliplet.Widget.initializeChildren(container, instance);
            resolve(instance);
            return;
          }

          // Initially hide container
          container.classList.add('hidden');

          // Process conditions only once per unique container ID
          if (processedIds[containerId]) {
            // If conditions were already evaluated and passed, show this container
            if (conditionResults[containerId]) {

              // Find the specific container for this parent context
              const containerInfo = containersByIds[containerId].find(info =>
                info.element === container ||
                info.parentContext === parent
              );

              if (containerInfo && !containerInfo.initialized) {
                container.classList.remove('hidden');
                await Fliplet.Widget.initializeChildren(container, instance);

                // Mark this specific container as initialized
                containerInfo.initialized = true;
              }
            }

            resolve(instance);
            return;
          }

          // Mark as processed to avoid redundant condition checking
          processedIds[containerId] = true;

          // Evaluate conditions
          const result = await evaluateConditions(data);

          // Store result for future reference
          conditionResults[containerId] = result;

          if (result) {
            // Show all containers with the same ID
            await showAllContainersWithId(containerId, data, parent);
          }

          resolve(instance);
        } catch (error) {
          console.error('Error in conditional container:', error);
          resolve(instance); // Resolve anyway to prevent blocking UI
        }
      });

      // Store instance promise for API access
      containerInstances[containerId] = instancePromise;

      return instancePromise;
    }, {
      supportsDynamicContext: true
    });
  })();

  /**
   * Determines if conditional mode is enabled
   * @param {Array|Boolean} conditionalSetting - Container setting
   * @returns {Boolean} Whether conditional mode is enabled
   */
  function isConditionalMode(conditionalSetting) {
    if (Array.isArray(conditionalSetting)) {
      return conditionalSetting.includes(true);
    }

    return !!conditionalSetting;
  }

  /**
   * Shows all containers with matching ID
   * @param {Number|String} containerId - Container ID
   * @param {Object} data - Container data
   * @param {Object} parent - Parent instance
   * @returns {Promise} Promise that resolves when all containers are initialized
   */
  async function showAllContainersWithId(containerId, data, parent) {
    const containersToUpdate = containersByIds[containerId] || [];
    const initPromises = [];

    // Show each container with this ID
    for (const info of containersToUpdate) {
      if (info.initialized) {
        continue;
      }

      const el = info.element;

      // Show the container
      el.classList.remove('hidden');

      // Create instance for this specific container
      const containerInstance = {
        id: containerId,
        uuid: data.uuid,
        parent: info.parentContext,
        element: el
      };

      // Initialize children of this container
      const initPromise = Fliplet.Widget.initializeChildren(el, containerInstance).then(() => {
        // Mark as initialized
        info.initialized = true;
      });

      initPromises.push(initPromise);
    }

    // Wait for all containers to initialize
    await Promise.all(initPromises);
  }

  /**
   * Evaluates container conditions against user data
   * @param {Object} data - Container data
   * @returns {Promise<Boolean>} Whether conditions are met
   */
  async function evaluateConditions(data) {
    try {
      // Get user session
      const session = await Fliplet.Session.get();

      if (!hasValidUserData(session)) {
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

        if (isConditionMet(userData, logic, value, condition.visibility)) {
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
   * Checks if user session has valid data
   * @param {Object} session - User session
   * @returns {Boolean} Whether session has valid data
   */
  function hasValidUserData(session) {
    return session && session.entries && session.entries.dataSource;
  }

  /**
   * Determines if a condition is met based on logic and visibility
   * @param {*} userData - User data to check
   * @param {String} logic - Logic type (equal, not-equal, contains)
   * @param {*} value - Value to compare against
   * @param {String} visibility - Show or hide behavior
   * @returns {Boolean} Whether condition is met
   */
  function isConditionMet(userData, logic, value, visibility) {
    let matches = false;

    // Evaluate based on logic type
    if (logic === 'equal') {
      matches = String(userData) === String(value);
    } else if (logic === 'not-equal') {
      matches = String(userData) !== String(value);
    } else if (logic === 'contains') {
      matches = checkContains(userData, value);
    }

    // Determine if condition result should show the container
    if (logic === 'not-equal') {
      // For not-equal, either show when not matching or hide when matching
      return matches ? visibility !== 'hide' : visibility === 'hide';
    }

    // For equal and contains, only show when matching and not hiding
    return matches && visibility !== 'hide';
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
    await Fliplet();
    const idFilter = getIdFilter(filter);

    const containers = await Promise.all(Object.values(containerInstances));
    const container = findContainer(containers, idFilter);

    // If container found, return it
    if (container) {
      return container;
    }

    // Container not found, handle retry
    return retryGetContainer(filter, options);
  };

  /**
   * Creates an ID filter object from various input formats
   * @param {Number|String|Object} filter - Filter input
   * @returns {Object} ID filter object
   */
  function getIdFilter(filter) {
    if (typeof filter === 'number' || typeof filter === 'string') {
      return { id: +filter };
    }
    return filter;
  }

  /**
   * Finds a container matching the filter criteria
   * @param {Array} containers - List of containers
   * @param {Object} filter - Filter criteria
   * @returns {Object|undefined} Matching container or undefined
   */
  function findContainer(containers, filter) {
    if (!filter) {
      return containers[0];
    }

    return containers.find(c =>
      Object.keys(filter).every(key => c[key] === filter[key])
    );
  }

  /**
   * Implements retry logic for getting containers
   * @param {Object} filter - Container filter
   * @param {Object} options - Retry options
   * @returns {Promise<Object>} Container instance
   */
  async function retryGetContainer(filter, options) {
    // Stop retrying after 5 seconds
    if (options.ts > 5000) {
      throw new Error(`Conditional container not found after ${Math.ceil(options.ts / 1000)} seconds.`);
    }

    // Exponential backoff
    const delay = options.ts ? options.ts * 1.5 : 10;

    // Wait for delay
    await new Promise(resolve => setTimeout(resolve, delay));

    // Try again with updated options
    return Fliplet.ConditionalContainer.get(filter, { ...options, ts: delay });
  }

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
