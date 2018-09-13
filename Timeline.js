class timelinetick {}

timelinetick.TYPE = {
    MS: Symbol(),
    SEC: Symbol(),
    MIN: Symbol(),
    HOUR: Symbol(),
    DAY: Symbol(),
    WEEK: Symbol(),
    MONTH: Symbol()
};

class timelinemarker {}

timelinemarker.TYPE = {
    UNKNOWN_EVENT: Symbol()
}

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
        config = Ext.applyIf(Ext.clone(config), this.defaultConfig)
        this.callParent(arguments);
        this.group = d3.select(config.parent.id);
        this.surface = this.group.append('rect')
            .attr('width', this.barLength)
            .attr('height', this.barWidth)
            .attr('class', 'boundingBox');

        this.defs = this.group.append('defs')
            .append('clipPath')
            .attr('id', 'barContent')
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', this.barLength)
            .attr('height', this.barWidth);

        if (this.enableXAxis) {
            //Get the max min for the range
            var minDate = d3.min(this.data, function(d) { return d.value;});
            var maxDate = d3.max(this.data, function(d) { return d.value;});

            var scale = d3.scaleTime()
                .domain([minDate, maxDate])
                .range([20, this.barLength - 20]);

            var xAxis = d3.axisBottom(scale);
            this.group.append('g')
                .attr("transform", "translate(0," + this.barWidth + ")")
                .call(xAxis);
        }
        if (this.data.length) {
            //Add point
            var points = this.group.selectAll('.event')
                .data(this.data)
                .enter();
                
            points.append('line')
                .attr('x1', function(d) { return scale(d.value);})
                .attr('y1', this.barWidth/2)
                .attr('x2', function(d) { return scale(d.value);})
                .attr('y2', this.barWidth)
                .attr("class", 'elasticLine');

            points.append('circle')
                .attr('cx', function(d) { return scale(d.value);})
                .attr('cy', this.barWidth/2)
                .attr('r', 5);

        }
//        this.timeline = new TimelineChart(this.group, config.data, {});
    }
});