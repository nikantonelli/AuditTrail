
//If we select fields:true to fetch LBAPI records, we don't get any info in the 'data' section, 
//so we have to use the 'raw' section throughout.


Ext.define('AuditCard', {
    extend: 'Ext.Component',
    cls: 'rui-card',


    defaultConfig: {
        showReadyIcon: true,
        showBlockedIcon: true,
        width: 400,
    },

    constructor: function(config) {
        config = Ext.applyIf(Ext.clone(config), this.defaultConfig);
        this.callParent(arguments);
    },

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

    //Each change is in a table row of three columns
    _getChangeHtml: function ( record, key) {

        var html = '';
        //LBAPI does not store the full field info, so we can't find out what sort of field it is.
        //This means that we have to decode each one based on the name. Crap or what!

        var oname = record.raw._PreviousValues[key];
        var nname = record.raw[key];
        
        switch (key) {
            case 'UserStories' : {
                //We need to fetch the state of the UserStories at this particular date and add them to a list
                //If list of userstories is longer, get the new list. If it is shorter, get the _PreviousValues list
                //I believe LBAPI will record one add/remove per snapshot. I will accomodate more in the code just in case
                var added = [];
                var taken = [];

                if (oname) { 
                    (oname.length > nname.length) ? taken = _.difference(oname,nname) : added = _.difference(nname,oname); 
                    if (added.length) {
                        html += '<tr><td class="cardleftcol">' + 'Added User Story: ' + _.each(added, function(add) { return '<tr>' + add + '</tr>';});
                        html += '</td></tr>';
                    }
                    if (taken.length) {
                        html += '<tr><td class="cardleftcol">' + 'Removed User Story: ' + _.each(taken, function(subt) { return '<tr>' + subt + '</tr>';});
                        html += '</td></tr>';
                    }
                }
                else {
                    html += '<tr><td class="cardleftcol">' + 'Added User Story: ' + _.each(nname, function(add) { return '<tr>' + add + '</tr>';});
                }
                break;
            }
            case 'PlannedEndDate' : 
            case 'PlannedStartDate' :  {
                if ((nname === null) || (nname === '')) { nname = '1/1/9999';}

                html += '<tr><td class="cardleftcol">' + key;
                if ( oname === null) {
                    html += ' set to ' + Ext.Date.format(new Date(nname), 'd M Y');
                }
                else {
                    html += ' changed from ' + Ext.Date.format(new Date(oname), 'd M Y') + ' to ' + Ext.Date.format(new Date(nname), 'd M Y');
                }
                html += '</td></tr>';
                break;
            }
            case 'PlanEstimate' : 
            case 'PreliminaryEstimateValue':
            case 'TestCaseStatus': 
            case 'TaskStatus':
            case 'TaskEstimateTotal': 
            case 'DefectStatus': 
            case 'ScheduleState' :
            case 'State': {
                if ((nname === null) || (nname === '')) { nname = 'Unknown';}

                html += '<tr><td class="cardleftcol">' + key;
                if ( oname === null) {
                    html += ' set to ' + nname;
                }
                else {
                    html += ' changed from ' + oname + ' to ' + nname;
                }
                html += '</td></tr>';
                break;
            }
            case 'Name': {
                if (!nname) { nname = 'Unknown';}

                html += '<tr><td class="cardleftcol">' + key;
                if ( oname === null) {
                    html += ' set to "' + nname + '"';
                }
                else {
                    html += ' changed from "' + oname + '" to "' + nname + '"';
                }
                html += '</td></tr>';
                break;
            }

            case "DragAndDropRank":{
                if (!oname) { oname = '';}
                if (!nname) { nname = '';}        
                html += '<tr><td class="cardleftcol">' + key;
                if ( oname.length) {
                    if ( nname > oname ) {
                        html += ' moved up';
                    }
                    else {
                        html += ' moved down';
                    }
                }
                else {
                    html += ' set';
                }
                html += '</td></tr>';
                break;
            }
            case 'Expedite':
            case 'Ready': 
            case 'Blocked' : {
                html += '<tr><td class="cardleftcol">' + key;
                if ( oname === null) {
                    html += ' set to ' + (nname ? 'true':'false');
                }
                else {
                    html += ' changed to ' + (nname ? 'true':'false');
                }
                html += '</td></tr>';
                break;
                
            }
            case 'Release':
            case 'Iteration':
            case 'Project':
                html += '<tr><td class="cardleftcol">' + key;
                if ( (oname === null) || (!oname.Name)) {
                    html += ' set to ' + nname.Name;
                }
                else {
                    html += ' moved from ' + oname.Name + ' to ' + nname.Name;
                }
                html += '</td></tr>';
                break;

            default: {
                console.log( key, record);
                break;
            }
        }
        return html;
    },

    _getHtml: function() {
        var me = this;
        var html = '<div><table style="width:' + this.width + 'px" class="card-table">';

        /* TODO: What conditions can the lookback api create:
            1. item creation
            2. fields setting
            3. field update
            4. deletion???
        */
        if ( this.record.raw._PreviousValues ) {
            var k = Object.keys(this.record.raw._PreviousValues);

            // if (k.length > 0) {
            //     html += '<tr><th class="cardlefthdr">Field</th>' + '<th class="cardmiddlehdr">Before</th>' + '<th class="cardrighthdr">After</th></tr>';
            // }
            _.each(k, function(key) {                
                html += me._getChangeHtml(me.record, key);
            });
        }
        return html + '</table></div>';
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
        html.push('</tr></table>');
        html.push(this._getHtml());
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