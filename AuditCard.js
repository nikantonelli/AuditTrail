
//If we select fields:true to fetch LBAPI records, we don't get any info in the 'data' section, 
//so we have to use the 'raw' section throughout.


Ext.define('AuditCard', {
    extend: 'Ext.Component',
    cls: 'rui-card',
    width: 800,
    // items: [
    //     {
    //         xtype: 'container',
    //         itemId: 'cardbox',
    //         width: 800,
//            height: 400
//        }
//   ],

    config: {
        showReadyIcon: true,
        showBlockedIcon: true
    },

    _Owner: {},

    initComponent: function() {
        this.callParent(arguments);
        this.on('beforerender', this._onBeforeRender, this);
    },

    _getUserHtml: function() {
        var data = {
            Owner: '/user/' + this.record.raw['_User'],
        };
        return '<td>' + Ext.create('Rally.ui.renderer.template.CardOwnerImageTemplate', {}).apply(data) + '</td>';
    },

    _getChangeHtml: function() {
        var me = this;
        var html = '';
        
        /* TODO: What conditions can the lookback api create:
            1. item creation
            2. fields setting
            3. field update
            4. deletion???
        */
        if ( this.record.raw._PreviousValues ) {
            var k = Object.keys(this.record.raw._PreviousValues);

            if (k.length > 0) {
                html += '<tr><th class="cardlefthdr">Field</th>' + '<th class="cardmiddlehdr">Before</th>' + '<th class="cardrighthdr">After</th></tr>';
            }
            _.each(k, function(key) {
                
                //If the hydrate has given us an object, we needs its name
                var oname = me.record.raw._PreviousValues[key];
                var nname = me.record.raw[key];
                if (oname && oname.hasOwnProperty('Name')) { oname = oname.Name;}
                if (nname && nname.hasOwnProperty('Name')) { nname = nname.Name;}

                if (!oname) { oname = '';}
                if (!nname) { nname = '';}

                html += '<td class="cardleftcol">' + key + '</td>';
                html += '<td class="cardmiddlecol">' + oname + '</td>';
                html += '<td class="cardrightcol">' + nname + '</td>';
                html += '</tr><tr>';
            });
        }
        else {
            //TODO Columns without previousvalues
        }
        return html + '</tr><tr>';
    },

    _buildHtml: function () {
        var html = [];

        var artifactColorDiv = {
            tag: 'div',
            cls: 'artifact-color'
        };

        if (this.record.raw['DisplayColor']){
            artifactColorDiv.style = {
                backgroundColor: this.record.raw['DisplayColor']
            };
        }

        html.push(Ext.DomHelper.createHtml(artifactColorDiv));
        html.push('<div class="card-table-ct"><table style="width:' + this.width + 'px" class="card-table"><tr>');
        html.push(this._getUserHtml());
        html.push('<td>' + this.record.raw['FormattedID'] + '</td><td>' + 
            Ext.Date.format(new Date(this.record.raw['_ValidFrom']), 'Y-M-d H:i') + '</td>');
        html.push('</tr><tr>');
        html.push(this._getChangeHtml());

        html.push('</tr></table>');

        html.push('</div>');

        return html.join('\n');
    },
    
    _onBeforeRender: function () {
        this._displayState();
        this.html = this._buildHtml();
    },

    shouldShowReadyBorder: function () {
        return this.isReady() && this.showReadyIcon;
    },

    isReady: function () {
        return this.record.raw['Ready'];
    },

    shouldShowBlockedBorder: function () {
        return this.isBlocked() && this.showBlockedIcon;
    },

    isBlocked: function () {
        return this.record.raw['Blocked'];
    },

    _displayState: function () {
        this.removeCls(['blocked', 'ready']);

        if (this.shouldShowBlockedBorder()) {
            this.addCls('blocked');
        }

        if (this.shouldShowReadyBorder()) {
            this.addCls('ready');
        }
    }
});