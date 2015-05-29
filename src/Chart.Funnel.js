(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        //Cache a local reference to Chart.helpers
        helpers = Chart.helpers;

    var defaultConfig = {
        widthTop: 0.75,
        widthBottom: 0.2,
        height: 0.8,
        strokeColor: '#FFFFFF',
        fillColor: '#F7464A',
        strokeWidth: 1,
        equalHeight: true
    };

    Chart.Trapezoid = Chart.Element.extend({
        initialize: function() {
            // adjusted width when there are angles. These widths are euqal to
            // the base of the trapezoid
            this.xl = this.leftT > 0 ? this.height * Math.tan(this.leftT) : 0;
            this.xr = this.rightT > 0 ? this.height * Math.tan(this.rightT) : 0;
        },
        draw: function() {
            var halfStroke  = this.strokeWidth / 2;
            var ctx         = this.ctx;
            ctx.save();

            ctx.fillStyle   = this.fillColor;
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth   = this.strokeWidth;

            ctx.translate(this.x, this.y + halfStroke);
            ctx.beginPath();
            ctx.moveTo(0, 0)
            ctx.lineTo(this.xl, this.height - halfStroke);
            ctx.lineTo(this.xl + this.width, this.height - halfStroke);
            ctx.lineTo(this.xl + this.xr + this.width, 0);
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }
    });

    Chart.Type.extend({
        //Passing in a name registers this chart in the Chart namespace
        name: "Funnel",
        //Providing a defaults will also register the deafults in the chart namespace
        defaults : defaultConfig,
        //Initialize is fired when the chart is initialized - Data is passed in as a parameter
        //Config is automatically merged by the core of Chart.js, and is available at this.options
        initialize:  function(data){
            this.widthTop    = this.chart.width * this.defaults.widthTop;
            this.widthBottom = this.chart.width * this.defaults.widthBottom;
            this.height      = this.chart.height * this.defaults.height;
            this.originX     = (this.chart.width - this.widthTop) / 2;
            this.originY     = (this.chart.height - this.height) / 2;
            this.t           = Math.atan((this.widthTop - this.widthBottom)/(2 * this.height));
            this.tt          = Math.tan(this.t);

            this.segments    = [];

            this.wedgeClass = Chart.Trapezoid.extend({
                ctx: this.chart.ctx,
                fillColor: this.defaults.fillColor,
                strokeColor: this.defaults.strokeColor,
                strokeWidth: this.defaults.strokeWidth
            });

            // height for each segment when using equal height segments
            this.segmentHeight = this.height / data.length;

            // collated segment heights
            var segmentHeightTotal = 0;

            helpers.each(data, function(segment, segmentIndex) {
                var segmentWidth = this.getSegmentWidth(this.widthTop, this.tt, segmentHeightTotal, this.segmentHeight);

                if (segment.hasOwnProperty('sections')) {
                    var sectionValueTotal = 0;
                    var sectionWidthTotal = 0;

                    // individual section width will be a percent so we need to calculate
                    // the total value for all sections within this segment first
                    helpers.each(segment.sections, function(section) {
                        sectionValueTotal += section.value;
                    }, this);

                    helpers.each(segment.sections, function(section, sectionIndex) {
                        var sectionConfig = {
                            x: this.originX + sectionWidthTotal + this.getSegmentOffset(this.tt, segmentHeightTotal),
                            y: this.originY + segmentHeightTotal,
                            height: this.segmentHeight,
                            width: (segmentWidth / sectionValueTotal) * section.value,
                            leftT: 0,
                            rightT: 0,
                            fillColor: section.color
                        };

                        if (sectionIndex === 0) {
                            sectionConfig.leftT = this.t;
                            // as there is an angle on left side of the trapezoid the renderer
                            // will add a wedge, we need to adjust for the wedge width as well
                            sectionWidthTotal += this.segmentHeight * this.tt;
                        }

                        if ((sectionIndex + 1) === segment.sections.length) {
                            sectionConfig.rightT = this.t;
                        }

                        sectionWidthTotal += sectionConfig.width;
                        this.segments.push(new this.wedgeClass(sectionConfig))
                    }, this);
                } else {
                    this.segments.push(new this.wedgeClass({
                            x: this.originX + this.getSegmentOffset(this.tt, segmentHeightTotal),
                            y: this.originY + segmentHeightTotal,
                            height: this.segmentHeight,
                            width: this.getSegmentWidth(this.widthTop, this.tt, segmentHeightTotal, this.segmentHeight),
                            leftT: this.t,
                            rightT: this.t,
                            fillColor: segment.color
                        })
                    )
                }

                segmentHeightTotal += this.segmentHeight;
            },this);
            this.render();
        },

        // calculates the total width of segment
        getSegmentWidth: function(chartWidth, tt, y, segmentHeight) {
            var totalHeight = y + segmentHeight;

            return chartWidth - ((totalHeight * tt) * 2);
        },

        getSegmentOffset: function(tt, y) {
            return y * tt;
        },

        getSegmentsAtEvent : function(e){
            var segmentsArray = [];

            var location = helpers.getRelativePosition(e);
            helpers.each(this.segments,function(segment){
                if (this.inRange(location.x,location.y, segment)) segmentsArray.push(segment);
            },this);

            return segmentsArray;
        },

        inRange : function(chartX,chartY, segment){
            var pointRelativePosition = helpers.getAngleFromPoint(segment, {
                x: chartX,
                y: chartY
            });

            var distanceFromXCenter = chartX - segment.x,
                distanceFromYCenter = chartY - segment.y;

            // helpers.getAngleFromPoint assumes Chart.Arc to start from PI/2 (90Deg)
            // and will therefore adjust the angle for hit point in the top-left
            // quadrant by 2PI. Gauge however assumes starting point from radian
            // 0 and needs to remove this adjustment
            if (distanceFromXCenter < 0 && distanceFromYCenter < 0){
                pointRelativePosition.angle -= Math.PI*2;
            }

            //Check if within the range of the open/close angle
            var betweenAngles = (pointRelativePosition.angle >= segment.startAngle && pointRelativePosition.angle <= segment.endAngle),
                withinRadius = (pointRelativePosition.distance >= segment.innerRadius && pointRelativePosition.distance <= segment.outerRadius);

            return (betweenAngles && withinRadius);
            //Ensure within the outside of the arc centre, but inside arc outer
        },

        update : function(){

        },

        removeData: function(atIndex){

        },

        reflow : function(){

        },

        draw : function(easeDecimal){
            helpers.each(this.segments, function(segment) {
                segment.draw();
            });
        }
    });
}).call(this);
