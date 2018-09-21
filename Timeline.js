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
        minTickSpacing: 5, //Fewest number of SVG pixels between ticks.  
        enableXAxis: true     //Boolean as to whether to do the axes here  
    },

    constructor: function(config) {
//        me = this;
        config = Ext.applyIf(Ext.clone(config), this.defaultConfig);
        this.callParent(arguments);
    },
    
    initComponent: function() {
    
        this.timeline = d3.select(this.parent.id);
        this.leftEnd = this.minTickSpacing; //Bring in half a large circle size from the end so that we don't clip the first item
        this.rightEnd = this.barLength-(this.minTickSpacing + 30);  //As above, but also leave 30 for reset icon

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

        //Get the max min for the initial range
        //Then set the initial scaling factor
        this.scale = d3.scaleTime()
            .domain(d3.extent(this.data, function(d) { return d.timestamp; }))
            .range([this.leftEnd, this.rightEnd]);

        this._setUpGeom(this.data);

        this.force = d3.forceSimulation(this.data)
            .force("x", d3.forceX(function(d) { 
                return me.scale(d.timestamp); 
            }).strength(0.1))
//            .force("y", d3.forceY(this.barWidth * 0.75).strength(0.05))
            .force("collide", d3.forceManyBody().strength(-me.minTickSpacing*2))
            .stop();
//            .on("tick", function() { me._ticked(me);});
        for ( var i = 0; i < 150; i++) { this.force.tick();}

        //We may want the option of a zoomable area with no dates shown.
        if (this.enableXAxis) {
            this.xAxis = d3.axisBottom(this.scale);
            this.timeline.append('g')
                .attr('class', 'x axis')
                .call(this.xAxis)
                .call( function(x) { x.width = this.barWidth; x.length = this.barLength;});
        }

        //Add point
        var events = this.timeline.selectAll('.event')
            .data(this.data)
            .enter()
            .append("g")
            .attr("class", "event");
            
        var points = events.selectAll('.point')
            .data(this.data)
            .enter()
            .append("g")
            .attr('class', 'elastic point');

        //The position is going to be rubber banded to the baseline point
        points.append('line')
            .attr('x1', function(d) { return d.x;})
            .attr('y1', function(d) { return d.y;})
            .attr('x2', function(d) { return d.baseline.x;})
            .attr('y2', function(d) { return d.baseline.y;})
            .attr("class", 'elastic line');

            
        points.append('circle')
            .attr('cx', function(d) { return d.x;})
            .attr('cy', function(d) { return d.y;})
            .attr('r', this.minTickSpacing)
            .attr('class', function(d) {
                var clsStr = 'elastic';
                switch (d.markerType) {
                    case timelinemarker.TYPE.UNKNOWN_EVENT:
                        clsStr += ' point';
                        break;
                    case timelinemarker.TYPE.SIZE_CHANGE:
                    clsStr += ' change';
                    break;
                }
                return clsStr; 
            });

//        debugger;
        me.lines = me.timeline.selectAll('.elastic.line');
        me.ends = me.timeline.selectAll('.elastic.point');
        
    },

    _ticked: function(me) {
        me.lines             
            .attr('x1', function(d) { 
                return d.x;
            })
            .attr('y1', function(d) { return d.y;});
            // .attr('x2', function(d) { return d.baseline.x;})
            // .attr('y2', function(d) { return d.baseline.y;});
        me.ends
            .attr('cx', function(d) { return d.x;})
            .attr('cy', function(d) { return d.y;});
    },

    setBarlength: function(pixelLength) {
        this.barLength = pixelLength;
        this.scale.range([-(this.barLength/2)+this.barOffset, (this.barLength/2)+this.barOffset]);
    },

    _redrawTimeline: function() {
        if (this.enableXAxis) {
            var axis = this.timeline.select('.x.axis');
            axis.call(this.xAxis);
        }

        //Now shift all points of the lines to where they need to be
        this.timeline.selectAll('.elastic.line').transition()
            .duration (750)
            .attr('x1', function(d) { return d.x;})
            .attr('y1', function(d) { return d.y;})
            .attr('x2', function(d) { return this.scale(d.timestamp);})
            .attr('y2', function() { return 0;});

        this.force.restart(); //Quick way to get the circles to move.
    },

    _setUpGeom: function(points) {
        var me = this;
        _.each(points, function(d) {
            d.position = {x: me.scale(d.timestamp), y: me.barWidth/2};
            d.baseline = { x: me.scale(d.timestamp), y: 0}; //Where the line is on the axis
            d.x = d.position.x;
            d.y = d.position.y;
        });
    },

    zoomed: function() {

        var percent = (d3.event.sourceEvent.offsetX/this.barLength);
        if (d3.event.sourceEvent.type === 'wheel') {
            this.leftEnd +=  d3.event.sourceEvent.wheelDeltaX - (percent * d3.event.sourceEvent.wheelDeltaY); 
            this.rightEnd +=  d3.event.sourceEvent.wheelDeltaX + ((1-percent) * d3.event.sourceEvent.wheelDeltaY); 
        } else if (d3.event.sourceEvent.type === 'mousemove'){
            this.leftEnd +=  d3.event.sourceEvent.movementX - (percent * d3.event.sourceEvent.movementY); 
            this.rightEnd +=  d3.event.sourceEvent.movementX + ((1 - percent) * d3.event.sourceEvent.movementY); 
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