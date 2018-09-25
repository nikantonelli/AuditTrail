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
            var duration = new Date(record.get('_ValidTo')) - new Date(record.get('_ValidFrom'));
            data.push( {
                label: record.get('FormattedID'),
                markerType: me._parseType(record),
                timeStamp: new Date(record.get('_ValidFrom')),
                timeDuration: duration > (10 * 1000 * 60 * 60 * 24 * 365)? 1: duration,  //<10 years
                record: record
            });
        });

        //Check the last record to see if the date extends beyond today. If not, then it was deleted permanently
        //TODO

        var deletedDate = new Date(records[0].get("_ValidTo"));
        _.each(records, function(record) {
            var d = new Date(record.get("_ValidTo"));
            if (d > deletedDate) {
                deletedDate = d;
            }
        });
        //We had changes that don't continue beyond today, so it must have been deleted
        if ( deletedDate < new Date()) {
            data.push( {
                label: record.get('FormattedID'),
                markerType: timelinemarker.TYPE.ITEM_DELETION,
                timeStamp: deletedDate,
                timeDuration: duration > (10 * 1000 * 60 * 60 * 24 * 365)? 1: duration,  //<10 years
                record: record
            });
        }

        if (data.length >1) {
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
            })
        }
    },

    _parseType: function(record) {

        if ( record.raw._SnapshotType === 'CREATE') {
            return timelinemarker.TYPE.ITEM_CREATION;
        }
        else if ( record.raw._SnapshotType === 'DELETE') {
            return timelinemarker.TYPE.ITEM_DELETION;
        }
        else if ( record.raw._SnapshotType === 'RESTORE') {
            return timelinemarker.TYPE.ITEM_RESTORE;
        }

         var common = this._parseCommon(record);
         if (common) return common;

        //If we are here, we are most likely UPDATE
        record.raw._TypeHierarchy.reverse();
        if ( record.raw._TypeHierarchy[1] === 'Portfolio') {
            return this._parsePI(record);
        }

        switch (record.raw._TypeHierarchy[0]) {
            case  'HierarchicalRequirement': {
                return this._parseStory(record);
            }
            case  'Defect': {
                return this._parseDefect(record);
            }
            case  'Defect': {
                return this._parseTask(record);
            }
        }
        return timelinemarker.TYPE.UNKNOWN;

    },

    _parseStory: function(record) {
        var checkVar = [
            { field: 'PlanEstimate', type: timelinemarker.TYPE.SIZE_CHANGE },
        ];
        var retval = null;

        _.each(checkVar, function( check) {
            if ( checkVar = (record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field))){
                if (checkVar !== record.get(check.field)){
                    retval = check.type;
                }
            }    
        });

        //Do other type specific checks here
        return retval;
    },

    _parseCommon: function(record) {
        console.log(record);
        var checkVar = [
            { field: 'DragAndDropRank', type: timelinemarker.TYPE.DRAGNDROP_CHANGE },
            { field: 'Owner', type: timelinemarker.TYPE.OWNER_CHANGE },
            { field: 'Project', type: timelinemarker.TYPE.PROJECT_CHANGE },
        ];
        var retval = null;

        _.each(checkVar, function( check) {
            if ( checkVar = (record.raw._PreviousValues && record.raw._PreviousValues.hasOwnProperty(check.field))){
                if (checkVar !== record.get(check.field)){
                    retval = check.type;
                }
            }    
        });

        return retval;
    },

    _parseDefect: function(record) {
        return timelinemarker.TYPE.UNKNOWN_EVENT;
    },

    _parsePI: function(record) {
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
        var fieldsOfInterest = ['ScheduleState', 'State', 'Iteration', 'Release', 'Blocked', 'Ready', 'PlanEstimate', 'DragAndDropRank', 'Project', 'Owner'];
        var fieldsToHydrate = [
            'ScheduleState', 
            '_PreviousValues.ScheduleState', 
            'State', 
            '_PreviousValues.State', 
            'Project', 
            '_PreviousValues.Project', 
            'Owner', 
            '_PreviousValues.Owner', 
            '_User',
            '_TypeHierarchy'
            
        ];
        var neededFields = [
            'FormattedID', 
            'Name',
            '_ValidFrom', 
            '_ValidTo',
            '_User',
            '_SnapshotType',
            '_TypeHierarchy'
        ];
        var find = {
            "ObjectID": record.get('ObjectID'),
        };

        //Add previous values fetches
        _.each(fieldsOfInterest, function (field) { neededFields.push('_PreviousValues.' + field);});
        //Add the fields themselves
        neededFields = neededFields.concat(fieldsOfInterest);

        var kb_store = Ext.create('Rally.data.lookback.SnapshotStore',{
            findConfig: find,
            compress: true,
            fetch: neededFields,
//            fetch: true,
            hydrate: fieldsToHydrate,
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
