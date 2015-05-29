(function(){
    "use strict";

    var root = this,
        Chart = root.Chart,
        //Cache a local reference to Chart.helpers
        helpers = Chart.helpers;

    var defaultConfig = {
        //Number - Funnel top width as fraction of the chart conainer width
        widthTop: 0.75,

        //Number - Funnel bottom width as fraction of the chart conainer width
        widthBottom: 0.2,

        //Nunber - Height as fraction of chart container height
        height: 0.9,

        //String - Standard stroke colour for the funnel segments
        strokeColor: '#FFFFFF',

        //String - Standard fill colour for funnel segments
        fillColor: '#000000',

        //Number - Segment/Section stroke size
        strokeWidth: 1,

        //Boolean - Whether we should show each funnel segment as equal height
        equalHeight: true,

        //Number - Funnel type does not support animation
        animationSteps : 0,
    };

    Chart.Trapezoid = Chart.Element.extend({
        initialize: function() {
            // adjusted width when there are angles. These widths are euqal to
            // the base of the trapezoid
            this.xl = this.leftT > 0 ? this.height * Math.tan(this.leftT) : 0;
            this.xr = this.rightT > 0 ? this.height * Math.tan(this.rightT) : 0;
        },

        inRange: function(chartX, chartY) {
            return (chartX >= this.x + this.xl && chartX <= this.x + this.xl + this.width) && (chartY >= this.y && chartY <= this.y + this.height);
        },

        tooltipPosition : function(){
            return {
                x : this.x + ((this.xl + this.xr + this.width)/2),
                y : this.y + (this.height/2)
            };
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

            if (this.options.showTooltips){
                helpers.bindEvents(this, this.options.tooltipEvents, function(evt) {
                    var activeSegments = (evt.type !== 'mouseout') ? this.getSegmentsAtEvent(evt) : [];
                    // var activeBars = this.segme;
                    this.showTooltip(activeSegments);
                });
            }

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
                    var sections          = [];

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
                            fillColor: section.color,
                            label : section.label || null,
                            value : section.value,
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
                        sections.push(new this.wedgeClass(sectionConfig));
                    }, this);

                    this.segments.push(sections);
                } else {
                    this.segments.push(new this.wedgeClass({
                            x: this.originX + this.getSegmentOffset(this.tt, segmentHeightTotal),
                            y: this.originY + segmentHeightTotal,
                            height: this.segmentHeight,
                            width: this.getSegmentWidth(this.widthTop, this.tt, segmentHeightTotal, this.segmentHeight),
                            leftT: this.t,
                            rightT: this.t,
                            fillColor: segment.color,
                            label : segment.label || null,
                            value : segment.value
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
            helpers.each(this.segments, function(segment) {
                if (Object.prototype.toString.call(segment) === '[object Array]') {
                    helpers.each(segment, function(section) {
                        if (section.inRange(location.x,location.y)) segmentsArray.push(section);
                    })
                } else {
                    if (segment.inRange(location.x,location.y)) segmentsArray.push(segment);
                }
            },this);

            return segmentsArray;
        },

        update : function(){

        },

        removeData: function(atIndex){

        },

        reflow : function(){

        },

        draw : function(easeDecimal){
            this.clear();
            helpers.each(this.segments, function(segment) {
                if (Object.prototype.toString.call(segment) === '[object Array]') {
                    helpers.each(segment, function(section) {
                        section.draw();
                    })
                } else {
                    segment.draw();
                }
            });
        }
    });
}).call(this);
