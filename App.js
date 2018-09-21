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

    _newData: function() {

        //Parse the records into timeline data
        this.loadMask.hide();
        var data = [
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.UNKNOWN_EVENT,
                timestamp: new Date()
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.SIZE_CHANGE,
                timestamp: Ext.Date.add(new Date(), Ext.Date.HOUR, -1)
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.SIZE_CHANGE,
                timestamp: Ext.Date.add(new Date(), Ext.Date.HOUR, -2)
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.SIZE_CHANGE,
                timestamp: Ext.Date.add(new Date(), Ext.Date.HOUR, -2.5)
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.SIZE_CHANGE,
                timestamp: Ext.Date.add(new Date(), Ext.Date.HOUR, -3)
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.UNKNOWN_EVENT,
                timestamp: Ext.Date.add(new Date(), Ext.Date.MONTH, -1)
            }
        ];

        Ext.create('timeline', {
            parent: this.down('#svg'),
            barWidth: 100,
            barLength: this.getEl().getWidth(),
            tickType: timelinetick.TYPE.DAY,
            data: data
        });
    },

    //Set the SVG area to the surface we have provided
    _setSVGSize: function() {
        var svg = Ext.getElementById('svg');
        svg.setAttribute('width', this.getEl().dom.offsetWidth);
        //We are going to bung in a totally arbitrary height which the user can scroll down
        svg.setAttribute('height', 200);
    },

    _recordChosen: function(source, record) {
        //Get the LBAPI data for the item and then pass to parser
        var fieldsOfInterest = ['ScheduleState', 'State', 'Iteration', 'Release'];
        var fieldsToHydrate = [
            'ScheduleState', 
            '_PreviousValues.ScheduleState', 
            'State', 
            '_PreviousValues.State', 
            
        ];
        var neededFields = [
            'FormattedID', 
            'Name',
            '_ValidFrom', 
            '_ValidTo',
            '_User'
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
            fetch: neededFields,
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
        Ext.create('Rally.ui.dialog.ArtifactChooserDialog', {
            artifactTypes: types,
            autoShow: true,
            height: 500,
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
