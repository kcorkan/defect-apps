Ext.define('Rally.technicalservices.DefectsByFieldSettings',{
    singleton: true,

    filterOutExceptChoices: function(store) {

        store.filter([{
            filterFn:function(field){ 
                
                var attribute_definition = field.get('fieldDefinition').attributeDefinition;
                var attribute_type = null;
                if ( attribute_definition ) {
                    attribute_type = attribute_definition.AttributeType;
                }
                if (  attribute_type == "BOOLEAN" ) {
                    return true;
                }
                if ( attribute_type == "STRING" || attribute_type == "STATE" ) {
                    if ( field.get('fieldDefinition').attributeDefinition.Constrained ) {
                        return true;
                    }
                }
                if ( field.get('name') === 'State' ) { 
                    return true;
                }
                return false;
            } 
        }]);
    },
    
    getFields: function(settings, states){

        var includeStates = settings && settings.includeStates || [];
        if (Ext.isString(includeStates)){
            includeStates = includeStates.split(',');
        }

        var labelWidth = 200,
            stateOptions = _.map(states, function(s){
            var checked = Ext.Array.contains(includeStates, s);
            return { boxLabel: s, name: 'includeStates', inputValue: s, checked: checked };
        });

        var granularityStore = Ext.create('Ext.data.Store',{
            fields: ['name','value'],
            data: [
                    {name: "Day", value: 'day'},
                    {name: "Week", value: 'week'},
                    {name: "Month", value: 'month'}
            ]
        });

        var chartTypeStore = Ext.create('Ext.data.Store',{
            fields: ['name','value'],
            data: [
                {name: "Line", value: 'line'},
                {name: "Column", value: 'column'}
            ]
        });

        return [{
                name: 'filterField',
                xtype:'rallyfieldcombobox',
                model:'Defect',
                labelAlign: 'right',
                labelWidth: labelWidth,
                listeners: {
                    ready: function(field_box) {
                        Rally.technicalservices.DefectsByFieldSettings.filterOutExceptChoices(field_box.getStore());
                    }
                },
                readyEvent: 'ready'
            },
            {
            xtype: 'combobox',
            fieldLabel: 'Chart Type',
            labelAlign: 'right',
            labelWidth: labelWidth,
            name: 'charttype',
            store: chartTypeStore,
            displayField: 'name',
            valueField: 'value',
        },{
            xtype: 'combobox',
            fieldLabel: 'Granularity',
            labelAlign: 'right',
            labelWidth: labelWidth,
            name: 'granularity',
            store: granularityStore,
            displayField: 'name',
            valueField: 'value'
        },{
            xtype: 'checkboxgroup',
            fieldLabel: 'Active States',
            labelAlign: 'right',
            labelWidth: labelWidth,
            columns: 2,
            width: 700,
            margin: '0 0 25 0',
            vertical: true,
            items: stateOptions
        }, {
            xtype: 'rallycheckboxfield',
            name: 'excludeUserStoryDefects',
            fieldLabel: 'Exclude User Story Defects',
            labelAlign: 'right',
            margin: '0 0 10 0',
            labelWidth: labelWidth
        }, {
            xtype: 'radiogroup',
            fieldLabel: 'Date Boundaries',
            labelAlign: 'right',
            labelWidth: labelWidth,
            columns: 1,
            margin: '0 0 0 0',
            vertical: true,
            listeners: {
                change: function(rg){
                    _.each(rg.items.items, function(i){
                        if (i && i.updateDateType){
                            i.updateDateType(rg.getValue().dateType);
                        }
                    });
                }
            },
            items: [
            
                {
                    name: "dateType",
                    itemId: "release",
                    boxLabel: "Selected Release",
                    baseLabel: "Selected Release",
                    inputValue: "release",
                    checked: settings.dateType === "release"
                }, {
                    name: "dateType",
                    itemId: "custom",
                    boxLabel: "Custom",
                    baseLabel: "Custom",
                    inputValue: "custom",
                    checked: settings.dateType === "custom"
                },{
                        xtype: 'rallydatefield',
                        name: 'customStartDate',
                        labelAlign: 'right',
                        labelWidth: labelWidth - 100,
                        fieldLabel: 'Start Date',
                        disabled: settings.dateType !== "custom",
                        value: settings.customStartDate,
                        updateDateType: function(dateType){
                            this.setDisabled(dateType !== "custom");
                        }
                    }, {
                        xtype: 'rallydatefield',
                        name: 'customEndDate',
                        labelAlign: 'right',
                        labelWidth: labelWidth - 100,
                        fieldLabel: 'End Date',
                        disabled: settings.dateType !== "custom",
                        value: settings.customEndDate,
                        margin: '0 0 15 0',
                        updateDateType: function(dateType){
                            this.setDisabled(dateType !== "custom");
                        }

                }, {
                    name: "dateType",
                    itemId: "offset",
                    boxLabel: "Days from Today (e.g. Start Date = -30 displays data starting on " + Rally.util.DateTime.formatWithDefault(Rally.util.DateTime.add(new Date(), 'day', -30)) + ")",
                    baseLabel: "Days from Today (e.g. Start Date = -30 displays data starting on " + Rally.util.DateTime.formatWithDefault(Rally.util.DateTime.add(new Date(), 'day', -30)) + ")",
                    inputValue: "offset",
                    checked: settings.dateType === "offset"
                }, {
                        xtype: 'rallynumberfield',
                        name: 'offsetStartDate',
                        labelAlign: 'right',
                        labelWidth: labelWidth - 100,
                        fieldLabel: 'Start Date',
                        disabled: settings.dateType !== "offset",
                        value: settings.offsetStartDate,
                        maxValue: -1,
                        updateDateType: function(dateType){
                            this.setDisabled(dateType !== "offset");
                        }
                    }, {
                        xtype: 'rallynumberfield',
                        name: 'offsetEndDate',
                        labelAlign: 'right',
                        labelWidth: labelWidth - 100,
                        fieldLabel: 'End Date',
                        value: settings.offsetEndDate,
                        maxValue: 0,
                        disabled: settings.dateType !== "offset",
                        updateDateType: function(dateType){
                            this.setDisabled(dateType !== "offset");
                        }
                }]
        }];
    }
});
