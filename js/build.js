"use strict";

// Self-executing function to contain widget code
(async () => {
  try {
    // Make sure Fliplet is available
    await Fliplet();

    // Find all conditional container widgets
    document.querySelectorAll('[data-widget-package="com.fliplet.conditional-container"]').forEach(async (widget) => {
      const id = widget.getAttribute('data-conditional-container-id');
      
      try {
        // Load widget data
        const data = await Fliplet.Widget.getData(id);
        initializeWidget(widget, data);
      } catch (error) {
        console.error('Error loading widget data:', error);
      }
    });
  } catch (error) {
    console.error('Error initializing conditional container:', error);
  }
  
  /**
   * Main widget initialization function
   * @param {HTMLElement} widget - The widget container element
   * @param {Object} data - The widget instance data
   */
  function initializeWidget(widget, data) {
    // Create container element
    const container = document.createElement('div');
    container.className = 'conditional';
    
    // Append to the widget
    widget.appendChild(container);
    
    // Handle interact/edit mode
    if (Fliplet.Env.get('interact')) {
      container.classList.add('edit');
      container.innerHTML = '<div class="c-container text-center">Configure Conditional container and drag & drop components inside it</div>';
      
      // Initialize children components inside the container
      initializeChildrenInEditMode(container, data);
      return;
    }
    
    // Runtime code
    const conditions = data.conditions;
    const useAsConditionalContainer = data.useAsConditionalContainer?.includes(true);
    const isPreview = Fliplet.Env.get('preview');
    
    if (!useAsConditionalContainer) {
      // If not used as conditional container, just initialize children
      Fliplet.Widget.initializeChildren(container);
      return;
    }
    
    // By default container is hidden
    container.classList.add('hidden');
    
    // Check conditions
    checkConditions(container, data, isPreview);
  }
  
  /**
   * Initialize children in edit mode with specific UI feedback
   * @param {HTMLElement} container - The container element
   * @param {Object} data - The widget instance data 
   */
  async function initializeChildrenInEditMode(container, data) {
    try {
      await Fliplet.Widget.initializeChildren(container);
      
      if (!data.conditions || !data.conditions.length) {
        return;
      }
      
      const placeholder = container.querySelector('.c-container.text-center');
      if (placeholder) {
        placeholder.innerHTML = '';
      }
      
      container.style.border = '1px dotted orange';
    } catch (error) {
      console.error('Error initializing children:', error);
    }
  }
  
  /**
   * Checks conditions to determine container visibility
   * @param {HTMLElement} container - The container element
   * @param {Object} data - The widget instance data
   * @param {Boolean} isPreview - Whether we're in preview mode
   */
  async function checkConditions(container, data, isPreview) {
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
        container.classList.remove('hidden');
        await Fliplet.Widget.initializeChildren(container);
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
})();
