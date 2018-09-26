(function () {
    var Ext = window.Ext4 || window.Ext;

  Ext.define('timeline', {
    extend: 'Ext.container.Container',
    //An SVG implementation of a timeline as a group
    //If no sizing is given, we will use the incoming surface (aka parent via config)

    defaultConfig: {
        margin: '10 20 20 10',
        barWidth: 400,
        barLength: 600,
        tickInterval: 50,   //For histogram bar width
        tickType: Ext.Date.DAY,
        minTickSpacing: 10, //Fewest number of SVG pixels between ticks.  
        enableXAxis: true     //Boolean as to whether to do the axes here  
    },

    constructor: function(config) {
//        me = this;
        config = Ext.applyIf(Ext.clone(config), this.defaultConfig);
        // this.plugins = [
        //     {ptype: 'rallycardcontentleft'},
        //     {ptype: 'rallycardcontentright'}
        // ];
        // delete this.config.plugins;

        this.callParent(arguments);
    },
    
    destroy: function () {
        this.surface.remove();
        this.histogramPane.remove();
        this.callParent(arguments);
    },
    
    initComponent: function() {
    
        var me = this;
        this.timeline = d3.select(this.parent.id);
        this.leftEnd = this.minTickSpacing; //Bring in half a large circle size from the end so that we don't clip the first item
        this.rightEnd = this.barLength-this.minTickSpacing; 

        this.histogramPane = this.timeline.append("g")
            .append('rect')
            .attr('width', this.barLength)
            .attr('height', 100)    //Histogram is always this size
            .attr('class', 'histogrambox');

        this.surface = this.timeline.append('g')
            .attr('transform', 'translate(0,' + 100 + ')');

        //Background colouring
        this.surface.append('rect')
            .attr('width', this.barLength)
            .attr('height', this.barWidth)
            .attr('class', 'eventbox');

        //TODO: Check whether we need a clipPath as the box is already a viewport
        this.defs = this.surface.append('defs')
            .append('clipPath')
            .attr('id', 'barContent')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.barLength)
            .attr('height', this.barWidth);

        //Keep this global so we can access the current state of zoom
        this.zoom = d3.zoom();

        //Capture the zoom events and update the timeline
        this.surface.call(this.zoom.on('zoom', function() { me.zoomed();}));

        //Get the max min for the initial range
        var minDate = d3.min(this.data, function(d) { return d.timeStamp;});
        var maxDate = d3.max(this.data, function(d) { return d.timeStamp;});
        //Then set the initial scaling factor
        this.scale = d3.scaleTime()
            .domain([ Ext.Date.add( minDate, me.tickType, -1), Ext.Date.add( maxDate, me.tickType, 1)])
            .range([this.leftEnd, this.rightEnd]);

        this._setUpGeom(this.data);

        this.histogram = d3.histogram()
            .domain([ Ext.Date.add( minDate, me.tickType, -1), Ext.Date.add( maxDate, me.tickType, 1)])
            .value( function(d) { return d.timeStamp;});


        var bins = this.histogram(this.data);
        this.force = d3.forceSimulation(this.data)
            .force("x", d3.forceX(function(d) { 
                return me.scale(d.timeStamp); 
            }).strength(0.1))
            .force("y1", d3.forceY(this.barWidth/2).strength(0.1))
            .force("y3", d3.forceY(0).strength(-0.01))
            .force("collide", d3.forceManyBody().strength(-me.minTickSpacing*2))    //Stop overlapping dots
            .stop();
        
        //Do one now to set the initial positions
        this._forceCalculate();
        
        //Now we have the dot positions, mark them in the time domain

        //We may want the option of a zoomable area with no dates shown.
        if (this.enableXAxis) {
            this.xAxis = d3.axisBottom(this.scale)
                .ticks(10, "%Y %b %d %I:%M");
            this.surface.append('g')
                .attr('class', 'x axis')
                .call(this.xAxis)
                .call( function(x) { x.width = this.barWidth; x.length = this.barLength;});
        }

        //Add point
        this.surface.selectAll('.event')
            .data(this.data)
            .enter()
            .append("g")
            .attr("class", "event")
            .attr('id', function(d) { return 'event' + d.index;})
            .append('line')
            .attr('x1', function(d) { return d.x;})
            .attr('y1', function(d) { return d.y;})
            .attr('x2', function(d) { return d.baseline.x;})
            .attr('y2', function(d) { return d.baseline.y;})
            .attr('id', function(d) { return 'line' + d.index;})
            .attr("class", 'elastic line');
            
        var points = this.surface.selectAll('.point')
            .data(this.data)
            .enter()
            .append("g");

        //The position is going to be rubber banded to the baseline point
            
        points.append('circle')
            .attr('cx', function(d) { return d.x;})
            .attr('cy', function(d) { return d.y;})
            .attr('r', this.minTickSpacing)
            .attr('id', function(d) { return 'point' + d.index;})
            .attr('class', function(d) {
                var clsStr = 'elastic';
                switch (d.markerType.type) {
                    case timelinemarker.TYPE.UNKNOWN_EVENT:
                        clsStr += ' unknown mouse';
                        break;
                    case timelinemarker.TYPE.ITEM_CREATION:
                        clsStr += ' creation mouse';
                        break;
                    case timelinemarker.TYPE.ITEM_DELETION:
                        clsStr += ' delete mouse';
                        break;
                    case timelinemarker.TYPE.ITEM_RESTORE:
                        clsStr += ' creation mouse';
                        break;
                    case timelinemarker.TYPE.ITEM_UPDATE:
                        clsStr += ' change mouse';
                        break;
                }
                switch( d.markerType.subtype) {
                    case timelinemarker.TYPE.NORMAL:
                        clsStr += '';
                        break;
                    case timelinemarker.TYPE.WARNING:
                        clsStr += ' warning';
                        break;
                    case timelinemarker.TYPE.ERROR:
                        clsStr += ' warning';
                        break;
                }
                return clsStr; 
            });
        points.selectAll('.mouse')
            .on('mouseover', function(data, idx, arr ) { me._mouseOver(data, arr[idx],me);})            
            .on('mouseout', function( data, idx, arr) { me._mouseOut(data, arr[idx],me);});


        me.lines = me.timeline.selectAll('.elastic.line');
        me.ends = me.timeline.selectAll('.elastic.point');
        
    },


    _mouseOut: function(node, item, me){
        if (node.card) { node.card.hide(); }
        var assocLine = d3.selectAll('line').filter( function(line) { return (line.index === node.index);});
        //        assocLine.classed('line', true);
        assocLine.classed('highlightline', false);

    },

    _mouseOver: function(node,item, me) {
        if (!(node.record)) {
            //Only exists on real items, so do something for the 'unknown' item
            return;
        } else {

            //For th audit variant, we want to do a check of all the lookback changes associated with this item and do checks
            if ( !node.card) {
                var cardSize = 400;
                var card = Ext.create('AuditCard', {
                    'record': node.record,
                    constrain: false,
                    width: cardSize,
                    height: 'auto',
                    floating: true, //Allows us to control via the 'show' event
                    shadow: false,
                    showAge: true,
                    resizable: true,
                    listeners: {
                        show: function(card){
                            
                            //Move card to one side, preferably closer to the centre of the screen. TODO
//                            debugger;
                            var xpos = node.x;
                            var ypos = node.y;
                            var outerLayout = this.getEl().dom.offsetParent.getBoundingClientRect();
                            card.el.setLeftTop( 
                                (xpos - cardSize) < 0 ? xpos + (me.minTickSpacing*2) : ((xpos + cardSize) > outerLayout.width ? xpos - (cardSize + (me.minTickSpacing*2)) : xpos + (me.minTickSpacing*2)), 
                                (ypos + card.getSize().height)> outerLayout.height ? ypos - (cardSize + (me.minTickSpacing*2)) : ypos + (me.minTickSpacing*2)
                            );
                        }
                    }
                });
                node.card = card;
            }
            node.card.show();

            //Findthe line associated with this node and highlight
            var assocLine = d3.selectAll('line').filter( function(line) { return (line.index === node.index);});
//            assocLine.classed('line', false);
            assocLine.classed('highlightline', true);
        }
    }, 

    _redrawTimeline: function() {
        var me = this;
        if (this.enableXAxis) {
            var axis = this.surface.select('.x.axis');
            axis.call(this.xAxis);
        }

        //Now shift all points of the lines to where they need to be
        this.surface.selectAll('.elastic')
            .attr('x1', function(d) { 
                return me.scale(d.dotTime);})
            .attr('x2', function(d) { return me.scale(d.timeStamp);})
            .attr('cx', function(d) { 
                return me.scale(d.dotTime);});

    },

    _setUpGeom: function(points) {
        var me = this;
        _.each(points, function(d) {
            d.position = {x: me.scale(d.timeStamp), y: me.barWidth/2};
            d.baseline = { x: me.scale(d.timeStamp), y: 0}; //Where the line is on the axis
            d.x = d.position.x;
            d.y = d.position.y;
        });
    },

    zoomed: function() {

        var percent = (d3.event.sourceEvent.offsetX/this.barLength);
        if (d3.event.sourceEvent.type === 'wheel') {
            this.leftEnd +=  (d3.event.sourceEvent.wheelDeltaX - (percent * d3.event.sourceEvent.wheelDeltaY))/2; 
            this.rightEnd +=  (d3.event.sourceEvent.wheelDeltaX + ((1-percent) * d3.event.sourceEvent.wheelDeltaY))/2; 
        } else if (d3.event.sourceEvent.type === 'mousemove'){
            this.leftEnd +=  d3.event.sourceEvent.movementX - (percent * d3.event.sourceEvent.movementY); 
            this.right +=  d3.event.sourceEvent.movementX + ((1 - percent) * d3.event.sourceEvent.movementY); 
        } else {
            console.log('Oops!');
        }
        //Then zoom out using the scale and redraw technique
        this.scale.range([this.leftEnd , this.rightEnd]);

        // this.force.alpha(1);
        // this._forceCalculate();

        //Redraw after all calcs
        this._redrawTimeline();
    },

    _forceCalculate: function() {
        var me = this;
        this.force.force("collide", d3.forceManyBody().strength(-this.minTickSpacing*2* ((this.rightEnd-this.leftEnd)/this.barLength)));    //Stop overlapping dots
        for (var i = 0; i <150; i++) { this.force.tick();}
        _.each(this.data, function(datum) {
            datum.dotTime = me.scale.invert(datum.x);
        });
    }
  });
}());