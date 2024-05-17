/* eslint-disable no-eval */
Fliplet.Widget.instance({
  name: 'conditional-container-2-0-0',
  displayName: 'Conditional container',
  icon: 'fa-file-code-o',
  data: {
    placeholder: 'Conditional container configurations'
  },
  views: [
    {
      name: 'dtContent',
      displayName: 'Drag&drop area',
      placeholder: '<div class="well text-center">Add components here.</div>'
    }
  ],
  render: {
    template: [
      '<div class="conditional" data-view="dtContent"></div>'
    ].join(''),
    beforeReady: function() {
      let element = $(this.$el);

      element.toggleClass('edit', Fliplet.Env.get('interact'));
    },
    ready: async function() {
      let helper = this;

      if (Fliplet.Env.get('interact')) {
        await Fliplet.Widget.initializeChildren(helper.$el, helper);

        return Promise.resolve(true);
      }

      let result;
      let userNotLoggedMessage = 'User is not logged in';

      function getType(elem) {
        if (Array.isArray(elem)) {
          return 'array';
        }

        return typeof elem === 'string' ? 'string' : false;
      }

      function decodeHTMLEntities(str) {
        let temp = document.createElement('div');

        temp.style.display = 'none';
        temp.innerHTML = str;

        return temp.textContent || temp.innerText;
      }

      function getParsedType(elem) {
        try {
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
          if (eval(expression)) {
            return condition['visibility'];
          }
        } catch (error) {
          return false;
        }
      }

      function setResult(expr) {
        result = expr && expr !== 'hide';
      }

      function isConditionIncluded(array, condition) {
        let userValue = condition.user_value;

        if (array.includes(userValue) || array.some(value => typeof value === 'number' && value === Number(userValue))) {
          return setResult(condition.visibility);
        }
      }

      let conditions = this.fields.conditions;
      let isPreview = Fliplet.Env.get('preview');

      $(helper.el).addClass('hidden'); // by default button is hidden

      return Fliplet.Session.get()
        .then(async function onSessionRetrieved(session) {
          if (!session || !session.entries || !session.entries.dataSource) {
            if (isPreview) {
              return Fliplet.UI.Toast(userNotLoggedMessage);
            }

            return Promise.resolve(true);
          }

          let user = session.entries.dataSource.data;

          if (conditions) {
            for (let i = 0; i < conditions.length; i++) {
              let condition = conditions[i];
              let userKey = condition['user_key'];

              if (user.hasOwnProperty(userKey)) {
                let expression;
                let logic = condition.logic;

                if (logic !== 'contains') {
                  expression = '"' + user[userKey] + '"';

                  if (logic === 'equal') {
                    expression += ' === ' + '"' + condition.user_value + '"';
                  } else if (logic === 'not-equal') {
                    expression += ' !== ' + '"' + condition.user_value + '"';
                  }

                  setResult(evaluate(condition, expression));
                } else {
                  let keyType = getType(user[userKey]);

                  switch (keyType) {
                    case 'array':
                      isConditionIncluded(user[userKey], condition);
                      break;
                    case 'string':
                      // check if string can be parsed into JSON array
                      let parsedType = getParsedType(user[userKey]);

                      if (parsedType === 'array') {
                        let currentArray = JSON.parse(user[userKey]);

                        isConditionIncluded(currentArray, condition);
                      } else {
                        expression = user[userKey]
                          .split(',')
                          .map(el => el.trim())
                          .includes(decodeHTMLEntities(condition.user_value));
                        setResult(evaluate(condition, expression));
                      }

                      break;
                    default:
                      // other type but array or string
                      expression = '"' + user[userKey] + '".indexOf("' + condition.user_value + '") > -1';
                      setResult(evaluate(condition, expression));
                      break;
                  }
                }
              } else if (isPreview) {
                Fliplet.UI.Toast(`User doesn't contain key: ${userKey}`);
              }
            }
          }

          if (result) {
            $(helper.el).removeClass('hidden');
            await Fliplet.Widget.initializeChildren(helper.$el, helper);
          }

          return Promise.resolve(true);
        });
    }
  }
});
