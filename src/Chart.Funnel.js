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
        widthBottom: 0.25,

        //Nunber - Height as fraction of chart container height
        height: 0.9,

        //String - Standard stroke colour for the funnel segments
        strokeColor: '#FFFFFF',

        //String - Standard fill colour for funnel segments
        fillColor: '#000000',

        //String - Standard fill colour for funnel segment labels
        labelColor: '#888888',

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
        update: function(newProps) {
            newProps.xl = this.leftT > 0 ? newProps.height * Math.tan(this.leftT) : 0;
            newProps.xr = this.rightT > 0 ? newProps.height * Math.tan(this.rightT) : 0;
            Chart.Element.prototype.update.call(this, newProps);
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
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            if (this.segmentLabel) {
                ctx.fillStyle = this.labelColor;
                ctx.font = "10px sans-serif";
                ctx.textBaseline = "middle";
                ctx.textAlign = "left";
                ctx.fillText(this.segmentLabel, this.xl + this.xr + this.width, this.height/2);
            }
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
            this.widthTop    = this.chart.width * this.options.widthTop;
            this.widthBottom = this.chart.width * this.options.widthBottom;
            this.height      = this.chart.height * this.options.height;
            this.originX     = 0;
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
                fillColor: this.options.fillColor,
                strokeColor: this.options.strokeColor,
                strokeWidth: this.options.strokeWidth,
                labelColor: this.options.labelColor
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
                            segmentLabel: null,
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
                            sectionConfig.segmentLabel = segment.label;
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
                            segmentLabel: segment.label || null,
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
            this.widthTop    = this.chart.width * this.options.widthTop;
            this.widthBottom = this.chart.width * this.options.widthBottom;
            this.height      = this.chart.height * this.options.height;
            this.originX     = 0;
            this.originY     = (this.chart.height - this.height) / 2;

            // height for each segment when using equal height segments
            this.segmentHeight = this.height / this.segments.length;

            // collated segment heights
            var segmentHeightTotal = 0;

            helpers.each(this.segments, function(segment) {
                var segmentWidth = this.getSegmentWidth(this.widthTop, this.tt, segmentHeightTotal, this.segmentHeight);

                if (Object.prototype.toString.call(segment) === '[object Array]') {
                    var sectionValueTotal = 0;
                    var sectionWidthTotal = 0;

                    // individual section width will be a percent so we need to calculate
                    // the total value for all sections within this segment first
                    helpers.each(segment, function(section) {
                        sectionValueTotal += section.value;
                    });

                    helpers.each(segment, function(section) {
                        var sectionWidth = (segmentWidth / sectionValueTotal) * section.value;
                        section.update({
                            x: this.originX + sectionWidthTotal + this.getSegmentOffset(this.tt, segmentHeightTotal),
                            y: this.originY + segmentHeightTotal,
                            height: this.segmentHeight,
                            width: sectionWidth
                        });

                        if (section.leftT > 0) {
                            sectionWidthTotal += this.segmentHeight * this.tt;
                        }

                        sectionWidthTotal += sectionWidth;
                    }, this)
                } else {
                    segment.update({
                        x: this.originX + this.getSegmentOffset(this.tt, segmentHeightTotal),
                        y: this.originY + segmentHeightTotal,
                        height: this.segmentHeight,
                        width: this.getSegmentWidth(this.widthTop, this.tt, segmentHeightTotal, this.segmentHeight)
                    })
                }
                segmentHeightTotal += this.segmentHeight;
            }, this);
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
