define('d3.floorplan.heatmap', function(require){
    var d3 = require('d3'),
        extend = require('extend');

    //We need to require floorplan plugin
    require('floorplan');

    var DEFAULTS = {
        binSize: 30,
        name:'heatmap',
        keySelector: function(d){return d.x + "," + d.y;}
    };

    var HeatmapExport = function(options) {
        options = extend({}, DEFAULTS, options);

        var colors = "RdYlBu",
            scaleType = "normal",
            // scaleType = "quantile",
            _binSize = DEFAULTS.binSize,
            x = d3.scale.linear(),
            y = d3.scale.linear(),
            line = d3.svg.line()
                .x(function(d) { return x(d.x); })
                .y(function(d) { return y(d.y); }),
            format = d3.format(".4n"),
            id = "fp-heatmap-" + new Date().valueOf(),
            name = "heatmap";

        function Heatmap(g) {
            g.each(function(data) {
                if (! data || ! data.map) return;
                _svg = d3.select(this);
                if(data.binSize) Heatmap.binSize(data.binSize);
                return Heatmap.refresh(data);
            });
        }

        Heatmap.refresh = function(data, o){
            o = extend({}, DEFAULTS, o);

            if (! data || ! data.map) return;
            data.binSize && Heatmap.binSize(data.binSize);

            if (! data.units) data.units = "";
            else if (data.units.charAt(0) != ' ') data.units = " " + data.units;

            var values = data.map.map(function(d) {return d.value;})
                            .sort(d3.ascending);
            var colorScale,
                thresholds;

            switch (scaleType) {
                case "quantile":
                    colorScale = d3.scale.quantile()
                            .range([1, 2, 3, 4, 5, 6])
                            .domain(values);

                    thresholds = colorScale.quantiles();
                break;

                case "quantized":
                    colorScale = d3.scale.quantize()
                            .range([1, 2, 3, 4, 5, 6])
                            .domain([values[0],values[values.length-1]]);
                    var incr = (colorScale.domain()[1] - colorScale.domain()[0]) / 6;

                    thresholds = [incr, 2 * incr, 3 * incr, 4 * incr, 5 * incr];
                break;

                case "normal":
                    var mean = d3.mean(values);
                    var norm = function(v) {return Math.pow(v-mean,2);};
                    var sigma = Math.sqrt(d3.sum(values, norm) / values.length);

                    colorScale = d3.scale.quantile()
                            .range([1, 2, 3, 4, 5, 6])
                            .domain([mean - 6 * sigma, mean - 2 * sigma,
                                     mean - sigma, mean, mean + sigma,
                                     mean + 2 * sigma, mean + 6 * sigma]);

                    thresholds = colorScale.quantiles();
                break;


                default:  // custom
                    if (! customThresholds) customThresholds = thresholds;
                    var domain = customThresholds;
                    domain.push(domain[domain.length-1]);
                    domain.unshift(domain[0]);
                    colorScale = d3.scale.quantile()
                            .range([1, 2, 3, 4, 5, 6])
                            .domain(domain);
                    customThresholds = thresholds = colorScale.quantiles();
                break;

            }

            // setup container for visualization
            var vis = _svg.selectAll("g.heatmap").data([0]);
            vis.enter().append("g").attr("class","heatmap");

            if (this.__colors__ && this.__colors__ != colors) {
                vis.classed(this.__colors__, false);
            }
            vis.classed(colors, true);
            this.__colors__ = colors;

            var filterData = function(data){
                return data.map.filter(function(d) { return ! d.points; });
            };

            var cells = vis.selectAll("rect")
                .data(filterData(data), o.keySelector),
                cellsEnter = cells.enter().append("rect").style("opacity", 1e-6);

            cells.exit()
                .transition()
                .style("opacity", 1e-6)
                .remove();

            cellsEnter.append("title");

            cells.attr("x", function(d) { return x(d.x); })
                .attr("y", function(d) { return y(d.y); })
                .attr("height", Math.abs(y(_binSize) - y(0)))
                .attr("width", Math.abs(x(_binSize) - x(0)))
                .attr("class", function(d) { return "d6-" + colorScale(d.value); })
                .select("title")
                .text(function(d) {
                    return "value: " + format(d.value) + data.units;
                });

            function areaKeySelector(d) {
                return JSON.stringify(d.points);
            }

            function filterPoints(data){
                return data.map.filter(function(d) { return d.points; });
            }

            cellsEnter.transition().style("opacity", 0.6);

            var areas = vis.selectAll("path")
                .data(filterPoints(data), areaKeySelector);

            var areasEnter = areas.enter()
                .append("path")
                .attr("d", function(d) { return line(d.points) + "Z"; })
                .style("opacity", 1e-6);

            areas.exit()
                .transition()
                .style("opacity", 1e-6)
                .remove();

            areasEnter.append("title");

            areas.attr("class", function(d) { return "d6-"+colorScale(d.value); })
                .select("title")
                .text(function(d) {
                    return "value: " + format(d.value) + data.units;
                });

            areasEnter.transition().style("opacity", 0.6);

            var areaLabels = vis.selectAll("text")
                .data(filterPoints(data), areaKeySelector);

            var areaLabelsEnter = areaLabels.enter()
                .append("text")
                .style("font-weight", "bold")
                .attr("text-anchor", "middle")
                .style("opacity", 1e-6);

            areaLabels.exit()
                .transition()
                .style("opacity", 1e-6)
                .remove();

            areaLabels.attr("transform", function(d) {
                var center = {x:0, y:0};
                var area = 0;
                for (var i=0; i<d.points.length; ++i) {
                    var p1 = d.points[i];
                    var p2 = d.points[i+1] || d.points[0];
                    var ai = (p1.x * p2.y - p2.x * p1.y);
                    center.x += (p1.x + p2.x) * ai;
                    center.y += (p1.y + p2.y) * ai;
                    area += ai;
                }
                area = area / 2;
                center.x = center.x / ( 6 * area);
                center.y = center.y / ( 6*area);
                return "translate(" + x(center.x) + ","
                                    + y(center.y) + ")";
            }).text(function(d) { return format(d.value) + data.units; });

            areaLabelsEnter.transition().style("opacity",0.6);
        };

        Heatmap.binSize = function(binSize) {
            if (! arguments.length) return _binSize;
            _binSize = binSize;
            return Heatmap;
        };

        Heatmap.xScale = function(scale) {
            if (! arguments.length) return x;
            x = scale;
            return Heatmap;
        };

        Heatmap.yScale = function(scale) {
            if (! arguments.length) return y;
            y = scale;
            return Heatmap;
        };

        Heatmap.colorSet = function(scaleName) {
            if (! arguments.length) return colors;
            colors = scaleName;
            return Heatmap;
        };

        Heatmap.colorMode = function(mode) {
            if (! arguments.length) return scaleType;
            scaleType = mode;
            return Heatmap;
        };

        Heatmap.customThresholds = function(vals) {
            if (! arguments.length) return customThresholds;
            customThresholds = vals;
            return Heatmap;
        };

        Heatmap.id = function() {
            return id;
        };

        Heatmap.title = function(n) {
            if (! arguments.length) return name;
            name = n;
            return Heatmap;
        };

        return Heatmap;
    };

    d3.floorplan.heatmap = HeatmapExport;

});
