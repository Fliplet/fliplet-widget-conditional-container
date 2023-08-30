Fliplet.Widget.generateInterface({
  title: 'Conditional container',
  fields: [
    {
      type: 'html',
      html: '<div class="alert alert-info"><p>Please note the container will hide the components by default.</p><p>If multiple conditions are added and a user matches more than one condition, the last condition will overwite the previous conditions.</p></div>'
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
          ready: function(el, value){
            $(el).hide();
          }
        },
        {
          type: 'radio',
          name: 'visibility',
          label: 'Container visibility if condition is true',
          options: [{ value: 'hide', label: 'Hide' }, { value: 'show', label: 'Show' }],
          required: true
        },
        {
          name: 'user_key',
          type: 'text',
          label: 'Data field',
          required: true
        },
        {
          type: 'dropdown',
          name: 'logic',
          label: 'Logic',
          options: [
            { value: 'equal', label: 'Equals' },
            { value: 'not-equal', label: 'Doesn\'t equal' },
            { value: 'contains', label: 'Contains' },
          ],
          required: true
        },
        {
          name: 'user_value',
          type: 'text',
          label: 'Value',
          required: true
        }
      ]
    }
  ]
});