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
        minTickSpacing: 5, //Fewest number of SVG pixels between ticks.  
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
    
    initComponent: function() {
    
        var me = this;
        this.timeline = d3.select(this.parent.id);
        this.leftEnd = this.minTickSpacing; //Bring in half a large circle size from the end so that we don't clip the first item
        this.rightEnd = this.barLength-this.minTickSpacing; 

        this.histogramPane = this.timeline.append("g")
            .append('rect')
            .attr('width', this.barLength)
            .attr('height', 100)    //Histogram is always this size
            .attr('class', 'histogramBox');

        this.surface = this.timeline.append('g')
            .attr('transform', 'translate(0,' + 100 + ')');

        //Background colouring
        this.surface.append('rect')
            .attr('width', this.barLength)
            .attr('height', this.barWidth)
            .attr('class', 'eventBox');

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
            .force("collide", d3.forceManyBody().strength(-me.minTickSpacing*2))    //Stop overlapping dots
            .stop();
        
        //Do one now to set the initial positions
        for ( var i = 0; i<150; i++) this.force.tick();
        _.each(this.data, function(datum) {
            datum.dotTime = me.scale.invert(datum.x);
        });

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
        var events = this.surface.selectAll('.event')
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
                switch (d.markerType) {
                    case timelinemarker.TYPE.UNKNOWN_EVENT:
                        clsStr += ' unknown';
                        break;
                    case timelinemarker.TYPE.SIZE_CHANGE:
                    clsStr += ' change';
                    break;
                }
                return clsStr; 
            })
            .on('mouseover', function(data, idx, arr ) { me._mouseOver(data, arr[idx]);})            
            .on('mouseout', function( data, idx, arr) { me._mouseOut(data, arr[idx]);});


        me.lines = me.timeline.selectAll('.elastic.line');
        me.ends = me.timeline.selectAll('.elastic.point');
        
    },

    _mouseOut: function(node, item){
        if (node.card) node.card.hide();
    },

    _mouseOver: function(node,item) {
        if (!(node.record)) {
            //Only exists on real items, so do something for the 'unknown' item
            return;
        } else {

            //For th audit variant, we want to do a check of all the lookback changes associated with this item and do checks
            if ( !node.card) {
                var cardSize = 200;
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
                            var xpos = node.x;
                            var ypos = node.y;
                            card.el.setLeftTop( (xpos - cardSize) < 0 ? xpos + cardSize : 
                                    ((xpos + cardSize) > (this.getSize().width) ? xpos - cardSize: xpos)
                                    , 
                                (ypos + card.getSize().height)> this.getSize().height ? ypos - (card.getSize().height+20) : ypos);
                        }
                    }
                });
                node.card = card;
            }
            node.card.show();
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
                return me.scale(d.dotTime);})

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

        //Redraw after all calcs
        this._redrawTimeline();
    }
  });
}());