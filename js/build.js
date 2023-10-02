/* eslint-disable max-len */
/* eslint-disable new-cap */
/* eslint-disable max-depth */
/* eslint-disable max-statements */
/* eslint-disable no-eval */
Fliplet.Widget.instance({
  name: 'conditional-container',
  displayName: 'Conditional container',
  icon: 'fa-file-code-o',
  data: {
    placeholder: 'Conditional container configurations'
  },
  views: [
    {
      name: 'dt-content',
      displayName: 'Drag&drop area',
      placeholder: '<div class="well text-center">Add components here.</div>'
    }
  ],
  render: {
    template: [
      '<div class="conditional" data-view="dt-content"></div>'
    ].join(''),
    beforeReady: function() {
      let element = $(this.$el);

      Fliplet.Env.get('interact')
        ? element.addClass('edit') : element.removeClass('edit');
    },
    ready: async function() {
      await Fliplet.Widget.initializeChildren(this.$el, this);

      function ifArray(elem) {
        if (Array.isArray(elem)) {
          return 'array';
        } else if (typeof elem === 'string') {
          return 'string';
        }

        return false;
      }

      function decodeHTMLEntities(str) {
        var temp = document.createElement('div');

        temp.style.display = 'none';
        temp.innerHTML = str;

        return temp.textContent || temp.innerText;
      }

      function ifValidJson(elem) {
        try {
          JSON.parse(elem);

          let parsedValue = JSON.parse(elem);

          if (Array.isArray(parsedValue)) {
            return 'array';
          }

          return false;
        } catch (error) {
          return 'string';
        }
      }

      function evaluate(condition, expression) {
        try {
          eval(expression);

          if (eval(expression)) {
            return condition['visibility'];
          }
        } catch (error) {
          // console.log('Expression can\'t be evaluated. Error: ' + error);

          return false;
        }
      }

      function setResult(expr) {
        if (expr) {
          return expr === 'hide' ? false : true;
        }

        return false;
      }

      function ifArrayIncludes(array, condition) {
        if (array.includes(condition['user_value'])) {
          return setResult(condition['visibility']);
        }

        _.forEach(array, function(value) {
          if (typeof value === 'number') {
            // user value to number
            if (value === +condition['user_value']) {
              return setResult(condition['visibility']);
            }
          }
        });
      }

      let helper = this;
      let conditions = this.fields.conditions;
      let environment = Fliplet.Env.get('preview');

      $(helper.el).addClass('hidden'); // by default button is hidden

      return Fliplet.Session.get()
        .then(function onSessionRetrieved(session) {
          if (session && session.entries) {
            if (session.entries.dataSource) {
              let user = session.entries.dataSource.data;
              let result;

              if (conditions) {
                for (let i = 0; i < conditions.length; i++) {
                  if (user.hasOwnProperty(conditions[i]['user_key'])) {
                    let expression;
                    let logic = conditions[i]['logic'];

                    if (logic !== 'contains') {
                      expression = '"' + user[conditions[i]['user_key']] + '"';

                      if (logic === 'equal') {
                        expression += ' === ' + '"' + conditions[i]['user_value'] + '"';
                      } else if (logic === 'not-equal') {
                        expression += ' !== ' + '"' + conditions[i]['user_value'] + '"';
                      }
                      /* else if (logic === 'starts'){
                      expression += '.indexOf("' + conditions[i]['user_value'] + '") === 0';
                    } else if (logic === 'ends'){
                      expression +=  '.endsWith("' + conditions[i]['user_value'] + '")';
                    }*/

                      result = setResult(evaluate(conditions[i], expression));
                    } else {
                      let keyType = ifArray(user[conditions[i]['user_key']]);

                      if (!keyType) {
                      // other type but array or string
                        expression = '"' + user[conditions[i]['user_key']] + '".indexOf("' + conditions[i]['user_value'] + '") > -1';
                        result = setResult(evaluate(conditions[i], expression));
                      } else if (keyType === 'string') {
                      // check if string can be parsed into JSON array
                        let ifJSON = ifValidJson(user[conditions[i]['user_key']]);

                        if (!ifJSON || ifJSON === 'string') {
                        // parsed value is not an array nor a string
                          expression = user[conditions[i]['user_key']]
                            .split(',')
                            .map(el => el.trim())
                            .includes(decodeHTMLEntities(conditions[i]['user_value']));
                          result = setResult(evaluate(conditions[i], expression));
                        } else if (ifJSON === 'array') {
                          let currentArray = JSON.parse(user[conditions[i]['user_key']]);

                          result = ifArrayIncludes(currentArray, conditions[i]);
                        }
                      } else if (keyType === 'array') {
                        result = ifArrayIncludes(user[conditions[i]['user_key']], conditions[i]);
                      }
                    }
                  } else if (environment) {
                    Fliplet.UI.Toast('User doesn\'t contain key: ' + conditions[i]['user_key']);
                  }
                }
              }

              if (result) {
                $(helper.el).removeClass('hidden');
              }
            } else if (environment) {
              Fliplet.UI.Toast('User is not logged in');
            }
          } else if (environment) {
            Fliplet.UI.Toast('User is not logged in');
          }

          return Promise.resolve(true);
        });
    },
    change: function(arrayOfFields) {
      _.forEach(arrayOfFields, function(field) {
        updatePanelTitleName(field);
      });

      function updatePanelTitleName(field) {
        let visibility = field[1].value;
        let key = field[2].value;
        let condition = field[3].value || '';
        let value = field[4].value;

        if (visibility && key && condition && value) {
          visibility = visibility.charAt(0).toUpperCase() + visibility.slice(1);
          condition = condition.charAt(0).toLowerCase() + condition.slice(1);

          if (condition.indexOf('equal') > -1) {
            condition += ' to';
          }

          let titleName = `${visibility} if "${key}" ${condition} "${value}"`;

          field[0].value = titleName;
        } else {
          field[0].value = 'Incomplete condition';
        }
      }
    }
  }
});
