Ext.define("DefectBurndown", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },

    
    config: {
        defaultSettings: {
            includeStates: ['Open', 'Submitted'],
            filterField: 'State',
            modelName: 'Defect',
            alwaysFetch: ['FormattedID','ObjectID','State','Severity','CreationDate',"_PreviousValues.State",'_ValidFrom','_ValidTo', 'Requirement'],
            excludeUserStoryDefects: true,
            granularity: 'day',
            dateType: 'release',
            offsetStartDate: -60,
            offsetEndDate: 0,
            customStartDate: Rally.util.DateTime.add(new Date(), 'day', -60),
            customEndDate: Rally.util.DateTime.add(new Date()),
            charttype: 'line'
        }
    },

    integrationHeaders : {
        name : "DefectBurndown"
    },

    severityAllowedValues: undefined,
    stateAllowedValues: undefined,

    launch: function() {
        this._initializeApp();
    },

    _initializeApp: function(){

        Rally.data.ModelFactory.getModel({
            type: 'Defect',
            success: function (model) {
                this.model = model;
                Deft.Promise.all([
                    this._fetchAllowedValues(model, 'State'),
                    this._fetchAllowedValues(model, 'Severity')]).then({

                    success: function (results) {
                        this.logger.log('launch', results);
                        this.stateAllowedValues = results[0];
                        this.severityAllowedValues = results[1];

                        if (this._validateSettings(this.getSettings())){
                            this._addSeverityOptions();
                        }
                    },
                    failure: function (msg) {
                        Rally.ui.notify.Notifier.showError({message: msg});
                    },
                    scope: this
                });
            },
            scope: this
        });
    },
    onTimeboxScopeChange: function(timeboxScope){
        this.logger.log('onTimeboxScopeChange', timeboxScope, this.getSetting('dateType'),timeboxScope.type === 'release',this.getSetting('dateType') === 'release');
        if (timeboxScope && timeboxScope.type === 'release' && this.getSetting('dateType') === 'release'){
            this.getContext().setTimeboxScope(timeboxScope);
            this._buildChart();
        }
    },
    _validateSettings: function(settings){
        this.logger.log('_validateSettings', settings);
        var msg = 'Please configure included defect states in the App Settings.';
        if (settings && settings.includeStates && settings.includeStates.length > 0){
            var startDate = this._getStartDate(),
                endDate = this._getEndDate();

            if (startDate && endDate){
                if (Date.parse(startDate) < Date.parse(endDate)){
                    return true;
                }
                msg = "Please select a Start Date that falls before the selected End Date."

            } else {

                if (settings.dateType === "release"){
                    msg = "A release date range has been selected in the App Settings.  Please confirm app is being run on a release scoped dashboard page."
                } else {
                    msg = "Please select a valid custom date range in the App Settings."
                }
            }
        }
        this.removeAll();
        this.add({
            xtype: 'container',
            html: msg
        });
        return false;
    },
    _addSeverityOptions: function(){
        this.removeAll();

        var labelWidth = 100,
            severityOptions = _.map(this.severityAllowedValues, function(s){
               return { boxLabel: s || "None",  inputValue: s, checked: true };
            }),
            columns = Math.min(8, severityOptions.length);
        this.add({
            xtype: 'container',
            layout: 'hbox',
            items: [
            {
                xtype: 'rallyfieldvaluecombobox',
                itemId: 'filterFieldValue',
                model: 'Defect',
                field: this.getSetting('filterField'),
                multiSelect: true,
                margin: 10,
                //fieldLabel: 'Include ' + this.getSetting('filterField') + ':',
                fieldLabel: 'Filter value(s):',
                labelWidth: labelWidth
               
            },{
                xtype: 'checkboxgroup',
                fieldLabel: 'Include Severity',
                labelAlign: 'right',
                itemId: 'includeSeverity',
                labelWidth: labelWidth,
                columns: columns,
                flex: 1,
                margin: 10,
                vertical: true,
                items: severityOptions
            },{
                xtype: 'rallybutton',
                text: 'Refresh',
                margin: '10 10 10 100',
                itemId: 'btn-refresh',
                disabled: true
            }]
        });

        var btn = this.down('#btn-refresh');
        btn.on('click', this._buildChart, this);

        this.down('#includeSeverity').on('change', function(cg){
            btn.setDisabled(false);
        }, this);
        
        this.down('rallyfieldvaluecombobox').on('blur', function(cg){
            btn.setDisabled(false);
        }, this);

        // don't want to build the chart unless we know what the filter field knows
        var filterFieldBox = this.down('rallyfieldvaluecombobox');
        
        if ( filterFieldBox.getStore().isLoading() ) {
            this.down('rallyfieldvaluecombobox').on('readt', function(cg){
                this._buildChart();
            }, this);
        } else {
            this._buildChart(); 
        }
    },
    _buildChart: function(btn){
        var settings = this.getSettings(),
            cg = this.down('#includeSeverity');

        if (btn) { btn.setDisabled(true); };
        this.logger.log('_buildChart',  settings);

        if (this.down('rallychart')){
            this.down('rallychart').destroy();
        }

        var query = settings.query,
            startDate = this._getStartDate(),
            endDate = this._getEndDate(),
            storeConfig = this._getStoreConfig(settings, startDate, endDate, query);

        var includeSeverity = this.severityAllowedValues;
        if (cg && cg.getValue){
            includeSeverity = _.values(cg.getValue());
        }
        
        var filterFieldValues = this.down('#filterFieldValue').getValue();
        
        console.log('--', filterFieldValues);

        this.add({
            xtype: 'rallychart',
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: storeConfig,
            calculatorType: 'DefectBurndownCalculator',
            calculatorConfig: {
                includeSeverity: includeSeverity,
                includeStates: this._getActiveStates(),
                includeField: this.getSetting('filterField'),
                includeFieldValues: filterFieldValues,
                startDate: startDate,
                endDate: endDate,
                granularity: settings.granularity,
                excludeUserStoryDefects: (settings.excludeUserStoryDefects === true || settings.excludeUserStoryDefects === 'true')
            },
            chartConfig: this._getChartConfig()
        });
    },
    _getStartDate: function(){
        var settings = this.getSettings(),
            startDate = null;

        switch (settings.dateType){
            case "release":
                startDate = this.getContext().getTimeboxScope() &&
                    this.getContext().getTimeboxScope().type === 'release' &&
                    this.getContext().getTimeboxScope().getRecord() &&
                        Rally.util.DateTime.fromIsoString(this.getContext().getTimeboxScope().getRecord().get('ReleaseStartDate')) || null;
                break;

            case "offset":
                startDate = Rally.util.DateTime.add(new Date(), 'day', settings.offsetStartDate);
                break;

            case "custom":
                startDate = settings.customStartDate;
                break;
        }
        if (startDate){
            return new Date(startDate);
        }
        return null;
    },
    _getEndDate: function(){
        var settings = this.getSettings(),
            endDate = null;

        switch (settings.dateType){
            case "release":
                endDate = this.getContext().getTimeboxScope() &&
                    this.getContext().getTimeboxScope().type === 'release' &&
                    this.getContext().getTimeboxScope().getRecord() &&
                    Rally.util.DateTime.fromIsoString(this.getContext().getTimeboxScope().getRecord().get('ReleaseDate')) || null;
                break;

            case "offset":
                endDate = Rally.util.DateTime.add(new Date(), 'day', settings.offsetEndDate);
                break;

            case "custom":
                endDate = settings.customEndDate;
                break;
        }
        if (endDate){
            return new Date(endDate);
        }
        return null;
    },

    _getTickInterval: function(){
        var startDate = this._getStartDate(),
            endDate = this._getEndDate(),
            granularity = this.getSetting('granularity'),
            total = Rally.util.DateTime.getDifference(endDate, startDate, granularity);

        if (total < 10){
            return 1;
        }
        return Math.round(total/10);
    },
    _getChartConfig: function(){
        var tickInterval = this._getTickInterval(),
            chartType = this.getSetting('charttype');
        return {
            chart: {
                zoomType: 'xy',
                type: chartType
            },
            title: {
                text: null
            },
            xAxis: {
                categories: [],
                tickmarkPlacement: 'on',
                tickInterval: tickInterval,
                title: {
                    text: 'Date',
                    margin: 10
                }
            },
            yAxis: [
                {
                    title: {
                        text: 'Count'
                    },
                    min: 0
                }
            ],
            tooltip: {
                formatter: function() {
                    return '' + this.x + '<br />' + this.series.name + ': ' + this.y;
                }
            },
            plotOptions: {
                series: {
                    marker: {
                        enabled: false,
                        states: {
                            hover: {
                                enabled: true
                            }
                        }
                    },
                    groupPadding: 0.01
                },
                column: {
                    stacking: null,
                    shadow: false
                }
            }
        };
    },
    _showError: function(msg){
        Rally.ui.notify.Notifier.showError(msg);
    },
    _getActiveStates: function(){
        var activeStates = this.getSetting('includeStates');
        if (Ext.isArray(activeStates)){
            return activeStates;
        }
        return activeStates.split(',');
    },
    _getStoreConfig: function(settings, startDate, endDate, query){
        var fetch = settings.alwaysFetch;

        startDate = Rally.util.DateTime.toIsoString(startDate);
        endDate = Rally.util.DateTime.toIsoString(endDate);
        var includeStates = this._getActiveStates();

        var find = {
            _ProjectHierarchy: this.getContext().getProject().ObjectID,
            _TypeHierarchy: 'Defect',
            "$or": [{State: {$in: includeStates}}, {"_PreviousValues.State": {$in: includeStates}}],
            _ValidTo: {$gte: startDate},
            _ValidFrom: {$lte: endDate}
        };

        var hydrate = ["State","Severity","_PreviousValues.State"];
        if ( !Ext.isEmpty(this.getSetting('filterField') ) ) {
            fetch.push(this.getSetting('filterField'));
            hydrate.push( this.getSetting('filterField'));
        }

        this.logger.log('_getStoreConfig', fetch, find, hydrate)
        return {
            fetch: fetch,
            find: find,
            hydrate: hydrate,
            limit: "Infinity",
            compress: true,
            removeUnauthorizedSnapshots: true,
            sort: {"_ValidFrom": 1 }
        };


    },
    _fetchData: function(config){
        var deferred = Ext.create('Deft.Deferred'),
            me = this;

        Ext.create('Rally.data.lookback.SnapshotStore', config).load({
            callback: function(records, operation){
                me.logger.log('_fetchData', operation, records);
                if (operation.wasSuccessful()){
                    deferred.resolve(records);
                } else {
                    deferred.reject(operation.error.errors.join(','));
                }
            }
        });

        return deferred;
    },
    getSettingsFields: function(){
        return Rally.technicalservices.DefectsByFieldSettings.getFields(this.getSettings(), this.stateAllowedValues);
    },
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },

    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        if (this._validateSettings(settings)){
            this._addSeverityOptions();
        }
        //this._buildChart(settings);

    },
    _fetchAllowedValues: function(model, fieldName){
        var deferred = Ext.create('Deft.Deferred');

        model.getField(fieldName).getAllowedValueStore().load({
            callback: function(records, operation, success) {
                this.logger.log('_fetchAllowedValues', records, operation);
                if (success){
                    var vals = _.map(records, function(r){ return r.get('StringValue').length === 0 ? "None" : r.get('StringValue'); });
                    deferred.resolve(vals);
                } else {
                    deferred.reject("Error fetching category data");
                }
            },
            scope: this
        });

        return deferred;
    }
});
