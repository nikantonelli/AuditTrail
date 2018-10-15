Ext.define('AuditApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    layout: 'auto',

    itemId: 'AuditApp',

    config: {
        defaultSettings:{
            enablePIs: true,
            enableStories: true,
            enableTasks: false,
            enableDefects: true,
            enableTestCases: false
        }
    },

    items: [
        {
            xtype: 'container',
            itemId: 'hdrBox',
            height: '100px'
        },
        {
            xtype: 'container',
            autoEl: {
                tag: 'svg'
            },
            id: 'svg',
            listeners: {
                afterrender: function() {  var gApp = this.up('rallyapp'); gApp._onElementValid(this);}
            }
        },
        {
            xtype: 'container',
            itemId: 'modList'
        }
    ],

    _onElementValid : function(surface) {
        this._setSVGSize(surface);
    },

    getSettingsFields: function() {

        return [
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Allow selection of Portfolio Items',
                name: 'enablePIs',
                labelAlign: 'top'
            },{
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Allow selection of Stories',
                name: 'enableStories',
                labelAlign: 'top'
            },
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Allow selection of Defects',
                name: 'enableDefects',
                labelAlign: 'top'
            },
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Allow selection of Tasks',
                name: 'enableTasks',
                labelAlign: 'top'
            },
            {
                xtype: 'rallycheckboxfield',
                fieldLabel: 'Allow selection of TestCases',
                name: 'enableTestcases',
                labelAlign: 'top'
            }
        ];
    },

    _newData: function(records) {

        var me = this;

        if (me.timeline) { me.timeline.destroy(); }

        //Parse the records into timeline data
        this.loadMask.hide();
        var data = [ ];

        _.each(records, function(record) {
            //If there is a record 
            if (record.raw._PreviousValues) {
                var duration = new Date(record.get('_ValidTo')) - new Date(record.get('_ValidFrom'));
                data.push( {
                    label: record.get('FormattedID'),
                    markerType: me._parseType(record),
                    timeStamp: new Date(record.get('_ValidFrom')),
                    timeDuration: duration > (10 * 1000 * 60 * 60 * 24 * 365)? 1: duration,  //<10 years
                    record: record
                });
            }
        });

        //Check the last record to see if the date extends beyond today. If not, then it was deleted permanently
        //TODO

        var deletedDate = new Date(records[0].get("_ValidTo"));
        var deletedRecord = null;
        _.each(records, function(record) {
            var d = new Date(record.get("_ValidTo"));
            if (d > deletedDate) {
                deletedDate = d;
                deletedRecord = record;
            }
        });
        //We had changes that don't continue beyond today, so it must have been deleted
        if ( deletedDate < new Date()) {
            var duration = new Date(deletedRecord.get('_ValidTo')) - new Date(deletedRecord.get('_ValidFrom'));
            data.push( {
                label: deletedRecord.get('FormattedID'),
                markerType: timelinemarker.TYPE.ITEM_DELETION,
                timeStamp: deletedDate,
                timeDuration: duration > (10 * 1000 * 60 * 60 * 24 * 365)? 1: duration,  //<10 years
                record: deletedRecord
            });
        }

        if (data.length >0) {
            me.timeline = Ext.create('timeline', {
                parent: this.down('#svg'),
                barWidth: 300,
                barLength: this.getEl().getWidth(),
                data: data
            });
        }
        else {
            Rally.ui.notify.Notifier.showWarning( {
                message: 'Insufficient history to show timeline'
            });
        }
    },

    /* We need to parse the error to work out what colouring to use in the timeline before we get there 
        So we will have a main event type and a calculate sub-type for a border around the timeline marker

        We also we need to re-calculate how to report the problem in the AuditCard code
    */
    _parseType: function(record) {
        var typeCode = { type: timelinemarker.TYPE.UNKNOWN_EVENT, subtype: timelinemarker.TYPE.UNKNOWN_EVENT};

        if ( record.raw._SnapshotType === 'CREATE') {
            typeCode.type = timelinemarker.TYPE.ITEM_CREATION;
        }
        else if ( record.raw._SnapshotType === 'DELETE') {
            typeCode.type = timelinemarker.TYPE.ITEM_DELETION;
        }
        else if ( record.raw._SnapshotType === 'RESTORE') {
            typeCode.type = timelinemarker.TYPE.ITEM_RESTORE;
        }
        else if ( record.raw._SnapshotType === 'UPDATE') {
            typeCode.type = timelinemarker.TYPE.ITEM_UPDATE;
        }

        var common = this._parseCommon(record);
        if (common) { 
             typeCode.subtype = common; 
        } else { 
            record.raw._TypeHierarchy.reverse();
            if ( record.raw._TypeHierarchy[1] === 'PortfolioItem') {
                typeCode.subtype = this._parsePI(record);
            }else {

                switch (record.raw._TypeHierarchy[0]) {
                    case  'HierarchicalRequirement': {
                        typeCode.subtype = this._parseStory(record);
                        break;
                    }
                    case  'Defect': {
                        typeCode.subtype = this._parseDefect(record);
                        break;
                    }
                    case  'Task': {
                        typeCode.subtype = this._parseTask(record);
                        break;
                    }
                }
                typeCode.subtype = typeCode.subtype? typeCode.subtype: timelinemarker.TYPE.NORMAL;  // Don't know what else to put here... error?
            }
        }
        return typeCode;

    },

    _parseStory: function(record) {
        var checkVar = [
            { field: 'PlanEstimate', type: timelinemarker.TYPE.NORMAL },    //Might want to warn if changed while Iteration is set
            { field: 'Release', type: timelinemarker.TYPE.WARNING },
            { field: 'Iteration', type: timelinemarker.TYPE.WARNING },
        ];
        var retval = null;

        _.each(checkVar, function( check) {
            var lvar = record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field);
            if ( lvar ){
                if (record.raw._PreviousValues[check.field] !== record.get(check.field)){
                    retval = check.type;
                }
            }    
        });

        //Do other type specific checks here
        return retval;
    },

    _parseCommon: function(record) {
        
        //Here, we might want to check the app settings to see which ones are to be warnings and which are to be errors

        var checkVar = [
            { field: 'Project', type: timelinemarker.TYPE.WARNING },
            { field: 'Name', type: timelinemarker.TYPE.WARNING },
        ];
        var retval = null;

        _.each(checkVar, function( check) {
            var lvar = record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field);
            if ( lvar ){
                if (record.raw._PreviousValues[check.field] !== record.get(check.field)){
                    retval = check.type;
                }
            }    
        });

        return retval;
    },

    _parseDefect: function(record) {
        var checkVar = [
            { field: 'Priority', type: timelinemarker.TYPE.WARNING },   
            { field: 'PlanEstimate', type: timelinemarker.TYPE.NORMAL },  //Might want to warn if changed while Iteration is set
            { field: 'TargetDate', type: timelinemarker.TYPE.WARNING },
            { field: 'Release', type: timelinemarker.TYPE.WARNING },
            { field: 'Iteration', type: timelinemarker.TYPE.WARNING },
        ];
        var retval = null;

        _.each(checkVar, function( check) {
            var lvar = record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field);
            if ( lvar ){
                if (record.raw._PreviousValues[check.field] !== record.get(check.field)){
                    retval = check.type;
                }
            }    
        });

        //Do other type specific checks here
        return retval;
    },

    _parsePI: function(record) {
        var retval = null;

        //We want to check to see if the Planned Start/End dates were modified while it was assigned to a release
        if ( record.raw._PreviousValues && 
                !record.raw._PreviousValues.hasOwnProperty('Release') && record.raw.hasOwnProperty('Release') &&    //Release set but no to it change here
                (record.raw._PreviousValues.hasOwnProperty('PlannedStartDate') || record.raw._PreviousValues.hasOwnProperty('PlannedEndDate'))  //Either of the dates changed?
        ) {
            retval = timelinemarker.TYPE.ERROR;
        }

        if (!retval) {
            var checkVar = [
                { field: 'State', type: timelinemarker.TYPE.NORMAL },
                { field: 'Children', type: timelinemarker.TYPE.NORMAL },
                { field: 'PlannedStartDate', type: timelinemarker.TYPE.NORMAL },    //Take note of the exception picked up in the code above!
                { field: 'PlannedEndDate', type: timelinemarker.TYPE.NORMAL },
                { field: 'PreliminaryEstimate', type: timelinemarker.TYPE.NORMAL },
                { field: 'UserStories', type: timelinemarker.TYPE.NORMAL },
            ];
    
            _.each(checkVar, function( check) {
                var lvar = record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field);
                if ( lvar ){
                    if (record.raw._PreviousValues[check.field] !== record.get(check.field)){
                        retval = check.type;
                    }
                }    
            });
    
        }
        return retval;
    },

    _parseTask: function(record) {
        return timelinemarker.TYPE.UNKNOWN_EVENT;
    },


    //Set the SVG area to the surface we have provided
    _setSVGSize: function() {
        var svg = Ext.getElementById('svg');
        svg.setAttribute('width', this.getEl().dom.offsetWidth);
        //We are going to bung in a totally arbitrary height which the user can scroll down
        svg.setAttribute('height', 1200);
    },

    _recordChosen: function(source, record) {
        //Get the LBAPI data for the item and then pass to parser. Can use blocked and ready for card colouring in timeline.js

        //Om userstories, we have a dynamically named field ('Feature'?) that we have no idea what it will be called here, but we can pick up 'Portfolio'
        var fieldsOfInterest = [
            'Blocked', 
            'Children',
            'DefectStatus',
            'DragAndDropRank', 
            'Expedite',
            'FlowState',
            'FormattedID',
            'Iteration', 
            'Name',
            'Owner',
            'Parent',
            'PlanEstimate', 
            'PlannedEndDate',
            'PlannedStartDate',
            'PortfolioItem',
            'PreliminaryEstimateValue', //Can't use PreliminaryEstimate or we would have to fetch the full object to get the real vlaue
            'Project', 
            'Ready', 
            'Release', 
            'Risks',
            'ScheduleState', 
            'State', 
            'TaskEstimateTotal',
            'TaskEstimateRemaining',
            'Tasks',
            'TaskStatus',
            'TestCases',
            'TestCaseStatus',
            'UserStories'
        ];

        //LBAPI cannot rehydrate all that we want, e.g. _User
        var fieldsToHydrate = [
            'Iteration',
            'Owner', 
            'Project', 
            'Release',
            'ScheduleState', 
            'State', 
        ];
        var neededFields = [
            '_ValidFrom', 
            '_ValidTo',
            '_User',
            '_SnapshotType',
            '_TypeHierarchy'
        ];
        var find = {
            "ObjectID": record.get('ObjectID'),
        };

        //Add the fields themselves
        neededFields = neededFields.concat(fieldsOfInterest);
        //Add previous values fetches
        _.each(fieldsOfInterest, function (field) { neededFields.push('_PreviousValues.' + field);});

        var hydrateFields = fieldsToHydrate;
        _.each(fieldsToHydrate, function (field) { hydrateFields.push('_PreviousValues.' + field);});

        //Add the needed one after adding previous
        hydrateFields.push( '_TypeHierarchy' );

        var kb_store = Ext.create('Rally.data.lookback.SnapshotStore',{
            findConfig: find,
            compress: true,
            fetch: neededFields,
//            fetch: true,
            hydrate: hydrateFields,
            removeUnauthorizedSnapshots: true,
            limit: 'Infinity'
        });
 
        kb_store.load({
             scope: this,
             callback: this._newData
        });
        
    },

    onSettingsUpdate: function() {
        var types = [];

        if (this.getSetting('enablePIs')) {
            _.each(this.typeStore.getRecords(), function(record) { types.push (record.data.TypePath.toLowerCase());});
        }
        if (this.getSetting('enableStories')) {
            types.push('userstory');
        }
        if (this.getSetting('enableDefects')) {
            types.push('defect');
        }
        if (this.getSetting('enableTasks')) {
            types.push('task');
        }
        if (this.getSetting('enableTestCases')) {
            types.push('testcase');
        }

        if (types.length === 0) {
            types.push('userstory');    //Always have at least one.
        }
        this.types = types;
},

    launch: function() {
        var me = this;
        me.loadMask = new Ext.LoadMask(this, { msg: 'Loading data....'});
        me.loadMask.hide();

        this.addListener('newData', this._recordChosen);

        //Get a database of the portfolio item types
        Ext.create('Rally.ui.combobox.PortfolioItemTypeComboBox',{
            itemId: 'typeStore',
            storeConfig: {
                listeners: {
                    load: function(store) {
                        me.typeStore = store;
                        //Make a list of artefact types that we support and pass to the chooser
                        me.onSettingsUpdate();
                        me._makeChooser(me.types);
                        me.down('#hdrBox').add({
                            margin: '10 10 10 10',
                            xtype: 'rallybutton',
                            text: 'Choose Item',
                            handler: function () {
                                me._makeChooser(me.types);
                            }
                        });
                    },
                    scope: me
                }
            }
        });
    },

    _makeChooser: function(types) {
        var me = this;

        //Problem: This chooser will only get existing artifacts, not stuff that has been deleted.        
        Ext.create('Rally.ui.dialog.ArtifactChooserDialog', {
            artifactTypes: types,
            autoShow: true,
            height: 500,
            storeConfig: {
                context: me.getContext().getDataContext(),
            },
            listeners: {
                artifactchosen: function(dialog, selectedRecord){
                    me.fireEvent( 'newData', this, selectedRecord );
                    me.loadMask.show();
                },
                scope: this
            }
         });
    }
});
