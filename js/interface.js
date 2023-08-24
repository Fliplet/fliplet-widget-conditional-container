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
      ],
      ready: function(el, arrayOfFields) {
        
        //action on expand/collapse all
        let collapseButton = $(el).find('.list-field .expand-items');
        collapseButton.on('click', function() {           
          if ($('.panel-title').first().find('.fa.chevron').hasClass('fa-chevron-right')) {
            $.each($('.panel-title'), function(){
              let index = $(this).closest('.panel.panel-default').index();
              updatePanelTitleName($(this), index);
            });
          }
        });

        //update condition title on ready
        $.each($('.panel-title'), function(){
          let index = $(this).closest('.panel.panel-default').index();
          updatePanelTitleName($(this), index);
        });

        //update condition title on collapsing
        $(document).on('click', '.panel-title', function() {            
          if ($(this).find('.fa.chevron').hasClass('fa-chevron-right')) {
            let index = $(this).closest('.panel.panel-default').index();
            console.log('index', index);
            updatePanelTitleName($(this), index);
          }
        });	
        
        function updatePanelTitleName(panelTitle, index){            
          let panelBody = panelTitle.closest('.panel-heading').next('.panel-collapse');
          let visibility = panelBody.find('[data-field="visibility"] input[type="radio"]:checked').val();
          let key = panelBody.find('[data-field="user_key"] input[type="text"]').val();              
          let condition = panelBody.find('[data-field="logic"] select[id*="logic"] :selected').text();
          condition = condition == '-- Select an option' ? '' : condition;
          let value = panelBody.find('[data-field="user_value"] input[type="text"]').val();
          arrayOfFields = Fliplet.Helper.field('conditions').get();
          
          if (visibility && key && condition && value){
            visibility = visibility.charAt(0).toUpperCase() + visibility.slice(1);
            condition = condition.charAt(0).toLowerCase() + condition.slice(1);
            if (condition.indexOf('equal') > -1){
              condition += ' to';
            }
            let titleName = `${visibility} if "${key}" ${condition} "${value}"`;
            arrayOfFields[index][0].value = titleName;
            panelTitle.find('.panel-title-text').text(titleName);
          } else {
            arrayOfFields[index][0].value = 'Incomplete condition';
            panelTitle.find('.panel-title-text').text('Incomplete condition');
          }
        }
      },
      change: function(arrayOfFields){
        _.forEach(arrayOfFields, function(field){
          updatePanelTitleName(field);
        });
        
        function updatePanelTitleName(field){   
          let visibility = field[1].value;
          let key = field[2].value;              
          let condition = field[3].value || '';
          let value = field[4].value;
          
          if (visibility && key && condition && value){
            visibility = visibility.charAt(0).toUpperCase() + visibility.slice(1);
            condition = condition.charAt(0).toLowerCase() + condition.slice(1);
            if (condition.indexOf('equal') > -1){
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
  ]
});