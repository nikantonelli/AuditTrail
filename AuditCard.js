Ext.define('AuditCard', {
    extend: 'Ext.Component',
    cls: 'rui-card',
    items: [
        {
            xtype: 'container',
            itemId: 'cardbox',
            width: 400,
            height: 400
        }
    ],

    config: {
        defaultConfig: {
            showReadyIcon: true,
            showBlockedIcon: true
        }
    },

    _Owner: {},

    initComponent: function() {
        this.callParent(arguments);
        var me = this;
        this.on('beforerender', this._onBeforeRender, this);
    },

    _getUserHtml: function() {
        var data = {
            Owner: '/user/' + this.record.get('_User'),
        }
        return Ext.create('Rally.ui.renderer.template.CardOwnerImageTemplate', {}).apply(data);
    },

    _buildHtml: function () {
        var html = [];

        var artifactColorDiv = {
            tag: 'div',
            cls: 'artifact-color'
        };

        if (this.record.get('DisplayColor')) {
            artifactColorDiv.style = {
                backgroundColor: this.record.get('DisplayColor')
            };
        }

        html.push(Ext.DomHelper.createHtml(artifactColorDiv));
        html.push('<div class="card-table-ct"><table class="card-table"><tr>');

        html.push(this._getUserHtml());

        html.push('</tr></table>');

        if (this.iconsPlugin) {
            html.push(this.iconsPlugin.getHtml());
        }

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
        return this.record.get('Ready');
    },

    shouldShowBlockedBorder: function () {
        return this.isBlocked() && this.showBlockedIcon;
    },

    isBlocked: function () {
        return this.record.get('Blocked');
    },

    _displayState: function () {
        this.removeCls(['blocked', 'ready']);

        if (this.shouldShowBlockedBorder()) {
            this.addCls('blocked');
        }

        if (this.shouldShowReadyBorder()) {
            this.addCls('ready');
        }
    },

    parseEvent: function(data, record) {
        debugger;
    }
});