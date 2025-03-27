function handleFieldVisibility(value) {
  Fliplet.Helper.field('conditions').toggle(value);
  $(document).find('.data-source-info').toggle(value);
}

Fliplet.Widget.generateInterface({
  title: 'Conditional container',
  fields: [
    {
      type: 'html',
      html: `<div class="alert alert-info data-source-info">
        <p>Please note the container will hide the components by default.</p>
        <p>
          If multiple conditions are added and a user matches more than one 
          condition, the last condition will overwrite the previous 
          conditions.
        </p>
      </div>`
    },
    {
      type: 'checkbox',
      name: 'useAsConditionalContainer',
      label: 'Use as a conditional container',
      default: [],
      options: [
        { value: true, label: 'Yes' }
      ],
      ready: function() {
        handleFieldVisibility(this.val().includes(true));
      },
      change: function(value) {
        handleFieldVisibility(value.includes(true));
      }
    },
    {
      name: 'conditions',
      label: 'Conditions',
      type: 'list',
      addLabel: 'Add condition',
      headingFieldName: 'title',
      emptyListPlaceholderHtml: '<p>Please add at least one condition</p>',
      fields: [
        {
          type: 'text',
          name: 'text',
          required: false,
          ready: function(el) {
            $(el).hide();
          }
        },
        {
          type: 'radio',
          name: 'visibility',
          label: 'Container visibility if condition is true',
          options: [
            { value: 'hide', label: 'Hide' },
            { value: 'show', label: 'Show' }
          ],
          required: true
        },
        {
          name: 'user_key',
          type: 'text',
          label: 'Enter login data source column name to create a logic',
          description: '(e.g. user type column “admin” equals “yes”)',
          required: true
        },
        {
          type: 'dropdown',
          name: 'logic',
          label: 'Logic',
          options: [
            { value: 'equal', label: 'Equals' },
            { value: 'not-equal', label: 'Doesn\'t equal' },
            { value: 'contains', label: 'Contains' }
          ],
          required: true
        },
        {
          name: 'user_value',
          type: 'text',
          label: 'Value',
          required: true
        }
      ],
      ready: function(el) {
        // action on expand/collapse all
        let collapseButton = $(el).find('.list-field .expand-items');
        let $panelTitle = $('.panel-title');

        collapseButton.on('click', function() {
          if (
            $panelTitle
              .first()
              .find('.fa.chevron')
              .hasClass('fa-chevron-right')
          ) {
            $.each($panelTitle, function() {
              let index = $(this)
                .closest('.panel.panel-default')
                .index();

              updatePanelTitleName($(this), index);
            });
          }
        });

        // update condition title on collapsing
        $(document).on('click', '.panel-title', function() {
          if (
            $(this)
              .find('.fa.chevron')
              .hasClass('fa-chevron-right')
          ) {
            let index = $(this)
              .closest('.panel.panel-default')
              .index();

            updatePanelTitleName($(this), index);
          }
        });

        // update condition title on ready
        $.each($panelTitle, function() {
          let index = $(this)
            .closest('.panel.panel-default')
            .index();

          updatePanelTitleName($(this), index);
        });

        function updatePanelTitleName(panelTitle, index) {
          let panelBody = panelTitle
            .closest('.panel-heading')
            .next('.panel-collapse');
          let visibility = panelBody
            .find('[data-field="visibility"] input[type="radio"]:checked')
            .val();
          let key = panelBody
            .find('[data-field="user_key"] input[type="text"]')
            .val();
          let condition = panelBody
            .find('[data-field="logic"] select[id*="logic"] :selected')
            .text();

          condition = condition === '-- Select an option' ? '' : condition;

          let value = panelBody
            .find('[data-field="user_value"] input[type="text"]')
            .val();

          let titleName = visibility && key && condition && value
            ? `${visibility.charAt(0).toUpperCase()
               + visibility.slice(1)} if "${key}" ${condition.toLowerCase()} 
               "${value}"`
            : 'Incomplete condition';

          let arrayOfFields = Fliplet.Helper.field('conditions').get();

          arrayOfFields[index][0].value = titleName;
          panelTitle.find('.panel-title-text').text(titleName);
        }
      }
    }
  ]
});
