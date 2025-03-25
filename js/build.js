"use strict";

// Self-executing function to contain widget code
(function() {
  Fliplet.ConditionalContainer = Fliplet.ConditionalContainer || {};
  
  const conditionalContainerInstances = {};

  Fliplet().then(function() {
    // Register the widget instance
    Fliplet.Widget.instance('conditional-container', function(data, parent) {
      const $container = $(this);
      const $emptyTemplate = $container.find('template[name="empty"]').eq(0);
      const emptyTemplate = $emptyTemplate.html();
      
      $emptyTemplate.remove();
      
      // Create instance container
      const container = new Promise((resolve) => {
        const instance = {
          id: data.id,
          uuid: data.uuid,
          parent
        };
        
        // Handle interact/edit mode
        if (Fliplet.Env.get('interact')) {
          if (Fliplet.Interact) {
            new Fliplet.Interact.ViewContainer($container, {
              placeholder: emptyTemplate
            });
          }
          
          // Initialize children components inside the container
          Fliplet.Widget.initializeChildren($container, instance);
          resolve(instance);
          return;
        }
        
        // Runtime code
        const conditions = data.conditions;
        const useAsConditionalContainer = data.useAsConditionalContainer?.includes(true);
        const isPreview = Fliplet.Env.get('preview');
        
        if (!useAsConditionalContainer) {
          // If not used as conditional container, just initialize children
          Fliplet.Widget.initializeChildren($container, instance).then(() => {
            resolve(instance);
          });
          return;
        }
        
        // By default container is hidden
        $container.addClass('hidden');
        
        // Check conditions
        checkConditions($container, data, isPreview, instance).then(() => {
          resolve(instance);
        });
      });
      
      container.id = data.id;
      conditionalContainerInstances[data.id] = container;
    }, {
      supportsDynamicContext: true
    });
  });
  
  /**
   * Checks conditions to determine container visibility
   * @param {jQuery} $container - The container element
   * @param {Object} data - The widget instance data
   * @param {Boolean} isPreview - Whether we're in preview mode
   * @param {Object} instance - The widget instance
   */
  async function checkConditions($container, data, isPreview, instance) {
    const userNotLoggedMessage = 'User is not logged in';
    let result = false;
    
    try {
      // Check user session and evaluate conditions
      const session = await Fliplet.Session.get();
      
      if (!session || !session.entries || !session.entries.dataSource) {
        if (isPreview) {
          Fliplet.UI.Toast(userNotLoggedMessage);
        }
        return;
      }
      
      const user = session.entries.dataSource.data;
      
      if (data.conditions) {
        for (const condition of data.conditions) {
          const userKey = condition['user_key'];
          
          if (!user.hasOwnProperty(userKey)) {
            if (isPreview) {
              Fliplet.UI.Toast(`User doesn't contain key: ${userKey}`);
            }
            continue;
          }
          
          const logic = condition.logic;
          let expression;
          
          if (logic !== 'contains') {
            expression = `"${user[userKey]}"`;
            
            if (logic === 'equal') {
              expression += ` === "${condition.user_value}"`;
            } else if (logic === 'not-equal') {
              expression += ` !== "${condition.user_value}"`;
            }
            
            result = evaluate(condition, expression, logic === 'not-equal');
          } else {
            const keyType = getType(user[userKey]);
            
            if (keyType === 'array') {
              result = isConditionIncluded(user[userKey], condition);
            } else if (keyType === 'string') {
              // check if string can be parsed into JSON array
              const parsedType = getParsedType(user[userKey]);
              
              if (parsedType === 'array') {
                const currentArray = JSON.parse(user[userKey]);
                result = isConditionIncluded(currentArray, condition);
              } else {
                expression = user[userKey]
                  .split(',')
                  .map(el => el.trim())
                  .includes(decodeHTMLEntities(condition.user_value));
                result = evaluate(condition, expression);
              }
            } else {
              // other type but array or string
              expression = `"${user[userKey]}".indexOf("${condition.user_value}") > -1`;
              result = evaluate(condition, expression);
            }
          }
          
          // If we found a matching condition, no need to check others
          if (result) {
            break;
          }
        }
      }
      
      // Show container if conditions are met
      if (result) {
        $container.removeClass('hidden');
        await Fliplet.Widget.initializeChildren($container, instance);
      }
    } catch (error) {
      console.error('Error checking conditions:', error);
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
      if (eval(expression)) {
        return condition['visibility'] !== 'hide';
      }
      
      if (notEqual) {
        return condition['visibility'] === 'hide';
      }
      
      return false;
    } catch (error) {
      console.error('Error evaluating condition:', error);
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
    if (typeof filter === 'number' || typeof filter === 'string') {
      filter = { id: +filter };
    }

    await Fliplet();
 
    const containers = await Promise.all(Object.values(conditionalContainerInstances));
    const objectMatch = (obj, filter) => Object.keys(filter).every(key => obj[key] === filter[key]);
    const container = filter ? containers.find(c => objectMatch(c, filter)) : containers[0];

    // Containers can render over time, so we need to retry later in the process
    if (!container) {
      if (options.ts > 5000) {
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

    return container;
  };

  /**
   * Get all conditional container instances
   * @param {Object|Function} filter - Filter by properties
   * @returns {Promise} Promise resolving to container instances
   */
  Fliplet.ConditionalContainer.getAll = function(filter) {
    if (typeof filter !== 'object' && typeof filter !== 'function') {
      filter = { id: filter };
    }

    return Fliplet().then(function() {
      return Promise.all(Object.values(conditionalContainerInstances)).then(function(containers) {
        if (typeof filter === 'undefined') {
          return containers;
        }

        return _.filter(containers, filter);
      });
    });
  };
})();
