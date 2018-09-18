(function () {
    var Ext = window.Ext4 || window.Ext;

  Ext.define('timeline', {
    extend: 'Ext.container.Container',
    //An SVG implementation of a timeline as a group
    //If no sizing is given, we will use the incoming surface (aka parent via config)

    defaultConfig: {
        margin: '10 20 20 10',
        barWidth: 60,
        barLength: 600,
        tickInterval: 1,
        tickType: timelinetick.TYPE.DAY,
        minTickSpacing: 20, //Fewest number of SVG pixels between ticks.  
        enableXAxis: true     //Boolean as to whether to do the axes here  
    },

    constructor: function(config) {
        me = this;
        config = Ext.applyIf(Ext.clone(config), this.defaultConfig)
        this.callParent(arguments);
    },
    
    initComponent: function() {
    
        this.timeline = d3.select(this.parent.id);
        this.leftEnd = -((this.barLength/2)+20);
        this.rightEnd = ((this.barLength/2)+20);

        this.surface = this.timeline.append('rect')
            .attr('width', this.barLength)
            .attr('height', this.barWidth)
            .attr('class', 'boundingBox');

        //TODO: Check whether we need a clipPath as the box is already a viewport
        this.defs = this.timeline.append('defs')
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
        var me = this;
        this.surface.call(this.zoom.on('zoom', function() { me.zoomed();}));

        //Capture the scroll events and update the timeline
        //TODO: timeline.select('.boundingBox').on('scroll', this.scrolled);

        //Get the max mid min for the initial range
        this.minDate = d3.min(this.data, function(d) { return d.value;});
        this.maxDate = d3.max(this.data, function(d) { return d.value;});
        this.midDate = Ext.Date.add(new Date(this.minDate),Ext.Date.MILLI, (this.maxDate-this.minDate)/2);

        //Set the initial scaling factor
        this.scale = d3.scaleTime()
            .domain([this.minDate, this.maxDate])
            .range([this.leftEnd, this.rightEnd]);

        //Initialise to the Identity transform
        this.transform = d3.zoomIdentity;

        //We may want the option of a zoomable area with no dates shown.
        if (this.enableXAxis) {
            this.xAxis = d3.axisBottom(this.scale);
            this.timeline.append('g')
                .attr("transform", "translate(" + this.barLength/2 + "," + this.barWidth + ")")
                .attr('class', 'x axis')
                .call(this.xAxis)
                .call( function(x) { x.width = this.barWidth; x.length = this.barLength;});
        }

        if (this.data.length) {
            //Add point
            var points = this.timeline.selectAll('.event')
                .data(this.data)
                .enter();
                
            this._setUpGeom(points);

            //The position is going to be rubber banded to the baseline point
            points.append('line')
                .attr('x1', function(d) { return d.position.x;})
                .attr('y1', function(d) { return d.position.y;})
                .attr('x2', function(d) { return d.baseline.x;})
                .attr('y2', function(d) { return d.baseline.y;})
                .attr("class", 'elastic line');

            points.append('circle')
                .attr('cx', function(d) { return d.position.x;})
                .attr('cy', function(d) { return d.position.y;})
                .attr('r', 5);

        }
    },

    setBarlength: function(pixelLength) {
        this.barLength = pixelLength;
        this.scale.range([-(this.barLength/2)+this.barOffset, (this.barLength/2)+this.barOffset]);
    },

    _redrawTimeline: function(me) {
        if (me.enableXAxis) {
            var axis = me.timeline.select('.x.axis')
            axis.call(me.xAxis);
        }

        //Now shift all points of the lines to where they need to be
        var lines = me.timeline.selectAll('.elastic.line').transition()
            .duration (750)
            // .attr('x1', function(d) { return me.scale(d.value);})
            // .attr('y1', function(d) { return me.barWidth/2;})
            .attr('x2', function(d) { return me.scale(d.value);})
            .attr('y2', function(d) { return me.barWidth;});

//        debugger;
    },

    _setUpGeom: function(points) {
        var me = this;
        points.each( function(d) {
            d.baseline = { x: me.scale(d.value), y: me.barWidth}; //Where the line is on the axis
            d.position = { x: me.scale(d.value), y: me.barWidth/2}; //Where the bubble sits after force diagram adjustment
        });
    },

    scrolled: function() {
        debugger;
    },

    zoomed: function() {

        if (d3.event.sourceEvent.type === 'wheel') {
            this.leftEnd +=  d3.event.sourceEvent.wheelDeltaX - d3.event.sourceEvent.wheelDeltaY; 
            this.rightEnd +=  d3.event.sourceEvent.wheelDeltaX + d3.event.sourceEvent.wheelDeltaY; 
        } else if (d3.event.sourceEvent.type === 'mousemove'){
            this.leftEnd +=  d3.event.sourceEvent.movementX - d3.event.sourceEvent.movementY; 
            this.rightEnd +=  d3.event.sourceEvent.movementX + d3.event.sourceEvent.movementY; 
        } else {
            debugger;
        }

        //Then zoom out using the scale and redraw technique
        this.scale.range([this.leftEnd , this.rightEnd]);

        //Redraw after all calcs
        me._redrawTimeline(me);
    }
//        this.timeline = new TimelineChart(timeline, config.data, {});
  })
}());