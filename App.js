Ext.define('AuditApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    layout: 'auto',
    items: [
        {
            xtype: 'container',
            itemId: 'hdrBox',
            height: '100px',
            items: [{
                xtype: 'rallyartifactsearchcombobox',
                storeConfig: {
                    models: ['userstory', 'defect']
                }
            }]
        },
        {
            xtype: 'container',
            autoEl: {
                tag: 'svg'
            },
            id: 'svg',
            listeners: {
                afterrender: function() {  gApp = this.up('rallyapp'); gApp._onElementValid(this);}
            }
        }
    ],

    _onElementValid : function(surface) {
        this._setSVGSize(surface);

        var data = [
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.UNKNOWN_EVENT,
                value: new Date()
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.UNKNOWN_EVENT,
                value: Ext.Date.add(new Date(), Ext.Date.MONTH, 1)
            },
            {
                label: 'US1 Story',
                markerType: timelinemarker.TYPE.UNKNOWN_EVENT,
                value: Ext.Date.add(new Date(), Ext.Date.MONTH, 2)
            }
            // {
            //     label: 'Name',
            //     data: [{
            //         type: TimelineChart.TYPE.POINT,
            //         at: new Date([2015, 1, 11])
            //     }, {
            //         type: TimelineChart.TYPE.POINT,
            //         at: new Date([2015, 1, 15])
            //     }, {
            //         type: TimelineChart.TYPE.POINT,
            //         at: new Date([2015, 3, 10])
            //     }, {
            //         label: 'I\'m a label',
            //         type: TimelineChart.TYPE.INTERVAL,
            //         from: new Date([2015, 2, 1]),
            //         to: new Date([2015, 3, 1])
            //     }, {
            //         type: TimelineChart.TYPE.POINT,
            //         at: new Date([2015, 6, 1])
            //     }, {
            //         type: TimelineChart.TYPE.POINT,
            //         at: new Date([2015, 7, 1]),
            //         customClass: 'custom-class'
            //     }]
            // }
        ];

        Ext.create('timeline', {
            parent: surface,
            barWidth: 100,
            barLength: this.getEl().getWidth(),
            tickType: timelinetick.TYPE.DAY,
            data: data
        });
    },

    //Set the SVG area to the surface we have provided
    _setSVGSize: function(surface) {
        var svg = Ext.getElementById('svg');
        svg.setAttribute('width', this.getEl().dom.offsetWidth);
        //We are going to bung in a totally arbitrary height which the user can scroll down
        svg.setAttribute('height', 200);
    },

    launch: function() {
    }
});
