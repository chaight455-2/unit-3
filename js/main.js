//wrap everything in a self-executing anonymous function to move to local scope
(function () {
    //pseudo-global variables
    //array of attribute objects with human-readable labels and units
    var attrObjects = [
        { attr: "premature_death_ypll_rate", label: "Premature Death Rate", unit: "Years per 100,000" },
        { attr: "pm25_avg_concentration", label: "PM2.5 Concentration", unit: "µg/m³" },
        { attr: "pct_excessive_drinking", label: "Excessive Drinking", unit: "%" },
        { attr: "pct_rural", label: "Rural Population", unit: "%" },
        { attr: "food_environment_index", label: "Food Environment Index", unit: "Score (0–10)" },
        { attr: "pct_severe_housing_problems", label: "Severe Housing Problems", unit: "%" },
        { attr: "avg_poor_physical_health_days", label: "Poor Physical Health Days", unit: "Days/Month" },
        { attr: "avg_poor_mental_health_days", label: "Poor Mental Health Days", unit: "Days/Month" },
        { attr: "pct_food_insecure", label: "Food Insecurity", unit: "%" },
    ];

    //derive a simple array of attribute names for data joins
    var attrArray = attrObjects.map(function (obj) {
        return obj.attr;
    });

    //create an object for different expressed variables
    var expressed = {
        x: attrArray[1], //x attribute: pm25_avg_concentration
        y: attrArray[0], //y attribute: premature_death_ypll_rate
        color: attrArray[8], //color/size attribute: pct_food_insecure
    };

    //active state filter: "all", "MN", or "WI"
    var stateFilter = "all";

    //chart frame dimensions — pseudo-global for access in changeAttribute()
    var chartWidth = window.innerWidth * 0.5 - 25,
        chartHeight = 460,
        leftPadding = 70,
        rightPadding = 20,
        topPadding = 20,
        bottomPadding = 60;

    //responsive: stack vertically on small screens
    if (window.innerWidth < 700) {
        chartWidth = window.innerWidth - 40;
    }

    //helper: look up the human-readable label for an attribute name
    function getAttrLabel(attrName) {
        for (var i = 0; i < attrObjects.length; i++) {
            if (attrObjects[i].attr === attrName) return attrObjects[i].label;
        }
        return attrName;
    }

    //helper: look up the unit string for an attribute name
    function getAttrUnit(attrName) {
        for (var i = 0; i < attrObjects.length; i++) {
            if (attrObjects[i].attr === attrName) return attrObjects[i].unit;
        }
        return "";
    }

    //begin script when window loads
    window.onload = setMap;

    //set up choropleth map
    function setMap() {
        //map frame dimensions — use pseudo-global chartWidth for consistency
        var width = chartWidth,
            height = chartHeight;

        //create new svg container for the map inside visContainer
        var map = d3
            .select("#visContainer")
            .append("svg")
            .attr("class", "map")
            .attr("width", width)
            .attr("height", height);

        //create Albers equal area conic projection centered on WI/MN
        var projection = d3
            .geoAlbers()
            .center([0, 46])
            .rotate([92, 0, 0])
            .parallels([43, 48])
            .scale(3200)
            .translate([width / 2, height / 2]);

        var path = d3.geoPath().projection(projection);

        //use Promise.all to parallelize asynchronous data loading
        var promises = [
            d3.csv("data/chr_2025_wi_mn.csv"),
            d3.json("data/wi_mn_counties_500k.topojson"),
        ];
        Promise.all(promises).then(callback);

        function callback(data) {
            var csvData = data[0],
                topoData = data[1];

            //translate TopoJSON to GeoJSON
            var counties = topojson.feature(
                topoData,
                topoData.objects.counties
            ).features;

            //join csv data to GeoJSON enumeration units
            counties = joinData(counties, csvData);

            //create the color scale
            var colorScale = makeColorScale(csvData);

            //add enumeration units to the map
            setEnumerationUnits(counties, map, path, colorScale);

            //add coordinated visualization to the map
            setChart(csvData, colorScale);

            //add legend to the map
            createLegend(map, colorScale);

            //add page title, dropdown menus, and state filter to navbar
            createTitle();
            createDropdown(csvData, "color", "Color/Size");
            createDropdown(csvData, "x", "X Axis");
            createDropdown(csvData, "y", "Y Axis");
            createStateFilter(csvData);
        }
    } //end of setMap()

    function joinData(counties, csvData) {
        //loop through csv to assign each set of csv attribute values to geojson counties
        for (var i = 0; i < csvData.length; i++) {
            var csvRow = csvData[i]; //the current county
            var csvKey = String(csvRow.fips); //the CSV primary key

            //loop through geojson counties to find correct county
            for (var a = 0; a < counties.length; a++) {
                var geojsonProps = counties[a].properties; //the current county geojson properties
                var geojsonKey = String(counties[a].id); //the geojson primary key

                //where primary keys match, transfer csv data to geojson properties object
                if (geojsonKey == csvKey) {
                    //transfer county name and fips for labeling
                    geojsonProps.county = csvRow.county;
                    geojsonProps.fips = csvRow.fips;
                    //assign all attributes and values
                    attrArray.forEach(function (attr) {
                        var val = parseFloat(csvRow[attr]); //get csv attribute value
                        geojsonProps[attr] = val; //assign attribute and value to geojson properties
                    });
                }
            }
        }
        return counties;
    }

    //function to create color scale generator
    function makeColorScale(data) {
        var colorClasses = [
            "#D4B9DA",
            "#C994C7",
            "#DF65B0",
            "#DD1C77",
            "#980043",
        ];

        //create color scale generator
        var colorScale = d3.scaleQuantile().range(colorClasses);

        //build array of all values of the expressed attribute
        var domainArray = [];
        for (var i = 0; i < data.length; i++) {
            var val = parseFloat(data[i][expressed.color]);
            if (!isNaN(val)) domainArray.push(val);
        }

        //assign array of expressed values as scale domain
        colorScale.domain(domainArray);

        return colorScale;
    }

    function setEnumerationUnits(counties, map, path, colorScale) {
        //add counties to map
        var countyPaths = map
            .selectAll(".county")
            .data(counties)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "county f" + d.id;
            })
            .attr("d", path)
            .style("fill", function (d) {
                //check to make sure a data value exists, if not set color to gray
                var value = d.properties[expressed.color];
                if (value) {
                    return colorScale(value);
                } else {
                    return "#ccc";
                }
            })
            .on("mouseover", function (event, d) {
                highlight(d.properties);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d.properties);
            })
            .on("mousemove", moveLabel);
    }

    //function to create coordinated bubble chart
    function setChart(csvData, colorScale) {
        //create a second svg element to hold the bubble chart inside visContainer
        var chart = d3
            .select("#visContainer")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create scales
        var yScale = createYScale(csvData);
        var xScale = createXScale(csvData);

        //set circles for each county
        var circles = chart
            .selectAll(".bubble")
            .data(csvData)
            .enter()
            .append("circle")
            .attr("class", function (d) {
                return "bubble f" + d.fips;
            })
            .attr("r", function (d) {
                var minRadius = 2.5;
                //calculate the radius based on expressed value using Flannery's compensation
                var radius =
                    Math.pow(parseFloat(d[expressed.color]), 0.5715) *
                    minRadius;
                return radius;
            })
            //place circles horizontally on the chart
            .attr("cx", function (d) {
                return xScale(parseFloat(d[expressed.x]));
            })
            //place circles vertically on the chart
            .attr("cy", function (d) {
                return yScale(parseFloat(d[expressed.y]));
            })
            .attr("fill", function (d) {
                return colorScale(parseFloat(d[expressed.color]));
            })
            .on("mouseover", function (event, d) {
                highlight(d);
            })
            .on("mouseout", function (event, d) {
                dehighlight(d);
            })
            .on("mousemove", moveLabel);

        //create axes
        createChartAxes(chart, yScale, xScale);

        //add linear regression line and R value
        updateRegressionLine(chart, csvData, xScale, yScale);
    }

    //function to calculate the minimum and maximum values for expressed variables
    function getDataValues(csvData, expressedValue) {
        var max = d3.max(csvData, function (d) {
            return parseFloat(d[expressedValue]);
        });
        var min = d3.min(csvData, function (d) {
            return parseFloat(d[expressedValue]);
        });
        var range = max - min,
            adjustment = range * 0.08;

        return [min - adjustment, max + adjustment];
    }

    //function to create y scale using pseudo-global dimensions
    function createYScale(csvData) {
        var dataMinMax = getDataValues(csvData, expressed.y);
        return d3
            .scaleLinear()
            .range([topPadding, chartHeight - bottomPadding])
            .domain([dataMinMax[1], dataMinMax[0]]);
    }

    //function to create x scale using pseudo-global dimensions
    function createXScale(csvData) {
        var dataMinMax = getDataValues(csvData, expressed.x);
        return d3
            .scaleLinear()
            .range([leftPadding, chartWidth - rightPadding])
            .domain([dataMinMax[0], dataMinMax[1]]);
    }

    //create axes using pseudo-global dimensions
    function createChartAxes(chart, yScale, xScale) {
        //create axis generators
        var yAxisScale = d3.axisLeft().scale(yScale);
        var xAxisScale = d3.axisBottom().scale(xScale);

        //place axis
        var yaxis = chart
            .append("g")
            .attr("class", "yaxis")
            .attr("transform", "translate(" + leftPadding + ",0)")
            .call(yAxisScale);

        var xaxis = chart
            .append("g")
            .attr("class", "xaxis")
            .attr("transform", "translate(0," + (chartHeight - bottomPadding) + ")")
            .call(xAxisScale);

        //y-axis label
        chart
            .append("text")
            .attr("class", "axisLabel yLabel")
            .attr("transform", "rotate(-90)")
            .attr("x", -chartHeight / 2)
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .text(getAttrLabel(expressed.y));

        //x-axis label
        chart
            .append("text")
            .attr("class", "axisLabel xLabel")
            .attr("x", chartWidth / 2)
            .attr("y", chartHeight - 10)
            .attr("text-anchor", "middle")
            .text(getAttrLabel(expressed.x));
    }

    //function to create a dynamic color legend on the map
    function createLegend(map, colorScale) {
        //remove any existing legend
        map.selectAll(".legend").remove();

        //legend dimensions and position
        var legendWidth = 20,
            legendHeight = 15,
            legendX = 10,
            legendY = chartHeight - 120;

        //get quantile breakpoints from the color scale
        var quantiles = colorScale.quantiles();
        var colors = colorScale.range();

        //create legend group
        var legend = map
            .append("g")
            .attr("class", "legend")
            .attr("transform", "translate(" + legendX + "," + legendY + ")");

        //add legend title
        legend
            .append("text")
            .attr("class", "legendTitle")
            .attr("x", 0)
            .attr("y", -5)
            .text(getAttrLabel(expressed.color));

        //add colored rectangles and labels for each class
        for (var i = 0; i < colors.length; i++) {
            //determine class range label
            var label;
            if (i === 0) {
                label = "< " + quantiles[0].toFixed(1);
            } else if (i === colors.length - 1) {
                label = "> " + quantiles[i - 1].toFixed(1);
            } else {
                label = quantiles[i - 1].toFixed(1) + " – " + quantiles[i].toFixed(1);
            }

            //color swatch
            legend
                .append("rect")
                .attr("x", 0)
                .attr("y", i * (legendHeight + 3))
                .attr("width", legendWidth)
                .attr("height", legendHeight)
                .style("fill", colors[i])
                .style("stroke", "#999");

            //class label
            legend
                .append("text")
                .attr("class", "legendText")
                .attr("x", legendWidth + 5)
                .attr("y", i * (legendHeight + 3) + legendHeight - 3)
                .text(label);
        }
    }

    //function to compute and draw a linear regression line with R value
    function updateRegressionLine(chart, csvData, xScale, yScale) {
        //remove any existing regression elements
        chart.selectAll(".regression-line").remove();
        chart.selectAll(".r-value").remove();

        //build paired arrays of x and y values, skipping missing data
        var xVals = [], yVals = [];
        for (var i = 0; i < csvData.length; i++) {
            var xv = parseFloat(csvData[i][expressed.x]);
            var yv = parseFloat(csvData[i][expressed.y]);
            if (!isNaN(xv) && !isNaN(yv)) {
                xVals.push(xv);
                yVals.push(yv);
            }
        }

        var n = xVals.length;
        if (n < 2) return;

        //calculate sums for least-squares regression
        var sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
        for (var j = 0; j < n; j++) {
            sumX += xVals[j];
            sumY += yVals[j];
            sumXY += xVals[j] * yVals[j];
            sumX2 += xVals[j] * xVals[j];
            sumY2 += yVals[j] * yVals[j];
        }

        //slope and intercept
        var slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        var intercept = (sumY - slope * sumX) / n;

        //Pearson correlation coefficient (r)
        var numerator = n * sumXY - sumX * sumY;
        var denominator = Math.sqrt(
            (n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY)
        );
        var r = denominator === 0 ? 0 : numerator / denominator;

        //determine line endpoints from the x-axis domain
        var xDomain = xScale.domain();
        var x1 = xDomain[0], x2 = xDomain[1];
        var y1 = slope * x1 + intercept;
        var y2 = slope * x2 + intercept;

        //draw the regression line
        chart
            .append("line")
            .attr("class", "regression-line")
            .attr("x1", xScale(x1))
            .attr("y1", yScale(y1))
            .attr("x2", xScale(x2))
            .attr("y2", yScale(y2));

        //display the R value in the top-right area of the chart
        chart
            .append("text")
            .attr("class", "r-value")
            .attr("x", chartWidth - rightPadding - 5)
            .attr("y", topPadding + 15)
            .attr("text-anchor", "end")
            .text("r = " + r.toFixed(3));
    }

    //function to highlight enumeration units and bubbles
    function highlight(props) {
        //add "selected" class to matching elements and raise them
        d3.selectAll(".f" + props.fips)
            .classed("selected", true)
            .raise();

        //create info label
        setLabel(props);
    }

    //function to dehighlight enumeration units and bubbles
    function dehighlight(props) {
        //remove "selected" class from matching elements
        d3.selectAll(".f" + props.fips)
            .classed("selected", false);

        //remove info label
        d3.selectAll(".infolabel").remove();
    }

    //function to create dynamic label
    function setLabel(props) {
        //remove any existing label before creating a new one
        d3.selectAll(".infolabel").remove();

        //label content: attribute value and county name
        var labelAttribute =
            "<h1>" + props[expressed.color] +
            "</h1><b>" + props.county + " — " +
            getAttrLabel(expressed.color) + " (" + getAttrUnit(expressed.color) + ")</b>";

        //create info label div, hidden until moveLabel positions it
        var infolabel = d3
            .select("body")
            .append("div")
            .attr("class", "infolabel")
            .attr("id", props.fips + "_label")
            .style("opacity", 0)
            .html(labelAttribute);
    }

    //function to move info label with mouse
    function moveLabel(event) {
        //guard: do nothing if label has not been created yet
        var labelNode = d3.select(".infolabel").node();
        if (!labelNode) return;

        //get label width for overflow testing
        var labelWidth = labelNode.getBoundingClientRect().width;

        //default and backup coordinates
        var x1 = event.clientX + 10,
            y1 = event.clientY - 75,
            x2 = event.clientX - labelWidth - 10,
            y2 = event.clientY + 25;

        //horizontal label coordinate, testing for overflow
        var x = event.clientX > window.innerWidth - labelWidth - 20 ? x2 : x1;
        //vertical label coordinate, testing for overflow
        var y = event.clientY < 75 ? y2 : y1;

        d3.select(".infolabel")
            .style("left", x + "px")
            .style("top", y + "px")
            .style("opacity", 1);
    }

    //function to create page title in the navbar
    function createTitle() {
        var pageTitle = d3
            .select(".navbar")
            .append("h1")
            .attr("class", "pageTitle")
            .text("Health & Environment in WI & MN");
    }

    //function to create a dropdown menu for attribute selection
    function createDropdown(csvData, expressedAttribute, menuLabel) {
        //add dropdown label
        var label = d3
            .select(".navbar")
            .append("p")
            .attr("class", "dropdown-label")
            .text(menuLabel + ": ");

        //add select element
        var dropdown = d3
            .select(".navbar")
            .append("select")
            .attr("class", "dropdown")
            .on("change", function () {
                changeAttribute(this.value, expressedAttribute, csvData);
            });

        //add attribute name options, marking the current one as selected
        var attrOptions = dropdown
            .selectAll("attrOptions")
            .data(attrObjects)
            .enter()
            .append("option")
            .attr("value", function (d) {
                return d.attr;
            })
            .property("selected", function (d) {
                return d.attr === expressed[expressedAttribute];
            })
            .text(function (d) {
                return d.label;
            });
    }

    //function to create state filter buttons in the navbar
    function createStateFilter(csvData) {
        var filterGroup = d3
            .select(".navbar")
            .append("div")
            .attr("class", "state-filter");

        //add label
        filterGroup
            .append("span")
            .attr("class", "dropdown-label")
            .text("Filter: ");

        //add a button for each filter option
        var options = ["all", "MN", "WI"];
        var labels = ["All", "Minnesota", "Wisconsin"];
        for (var i = 0; i < options.length; i++) {
            filterGroup
                .append("button")
                .attr("class", "filter-btn" + (options[i] === "all" ? " active" : ""))
                .attr("data-state", options[i])
                .text(labels[i])
                .on("click", function () {
                    var state = d3.select(this).attr("data-state");
                    stateFilter = state;

                    //update active button styling
                    d3.selectAll(".filter-btn").classed("active", false);
                    d3.select(this).classed("active", true);

                    //apply the filter to map and chart
                    applyStateFilter(csvData);
                });
        }
    }

    //function to show/hide counties and bubbles based on the active state filter
    function applyStateFilter(csvData) {
        //determine which FIPS codes belong to each state (MN: 27xxx, WI: 55xxx)
        d3.selectAll(".county")
            .transition()
            .duration(300)
            .style("opacity", function (d) {
                if (stateFilter === "all") return 1;
                var fips = String(d.id);
                var state = fips.substring(0, 2) === "27" ? "MN" : "WI";
                return state === stateFilter ? 1 : 0.08;
            });

        d3.selectAll(".bubble")
            .transition()
            .duration(300)
            .style("opacity", function (d) {
                if (stateFilter === "all") return 1;
                return d.state === stateFilter ? 1 : 0.08;
            });

        //update regression line to reflect only visible data
        var filteredData = csvData;
        if (stateFilter !== "all") {
            filteredData = csvData.filter(function (d) {
                return d.state === stateFilter;
            });
        }
        var xScale = createXScale(csvData);
        var yScale = createYScale(csvData);
        updateRegressionLine(d3.select(".chart"), filteredData, xScale, yScale);
    }

    //dropdown change event handler
    function changeAttribute(attribute, expressedAttribute, csvData) {
        //change the expressed attribute
        expressed[expressedAttribute] = attribute;

        //recreate scales
        var colorScale = makeColorScale(csvData);
        var yScale = createYScale(csvData);
        var xScale = createXScale(csvData);

        //recolor enumeration units on the map with animated transition
        var counties = d3
            .selectAll(".county")
            .transition()
            .duration(1000)
            .style("fill", function (d) {
                var value = d.properties[expressed.color];
                if (value) {
                    return colorScale(d.properties[expressed.color]);
                } else {
                    return "#ccc";
                }
            });

        //update bubbles on the chart with animated transition
        var circles = d3
            .selectAll(".bubble")
            .transition()
            .duration(1000)
            //recolor circles to match the map
            .attr("fill", function (d) {
                return colorScale(parseFloat(d[expressed.color]));
            })
            //resize circles based on new color attribute
            .attr("r", function (d) {
                var minRadius = 2.5;
                var radius =
                    Math.pow(parseFloat(d[expressed.color]), 0.5715) * minRadius;
                return radius;
            })
            //reposition circles on x and y axes
            .attr("cx", function (d) {
                return xScale(parseFloat(d[expressed.x]));
            })
            .attr("cy", function (d) {
                return yScale(parseFloat(d[expressed.y]));
            });

        //update axes
        d3.select(".xaxis").call(d3.axisBottom(xScale));
        d3.select(".yaxis").call(d3.axisLeft(yScale));

        //update axis labels
        d3.select(".xLabel").text(getAttrLabel(expressed.x));
        d3.select(".yLabel").text(getAttrLabel(expressed.y));

        //update the legend on the map
        createLegend(d3.select(".map"), colorScale);

        //update regression line and R value, respecting state filter
        var filteredData = csvData;
        if (stateFilter !== "all") {
            filteredData = csvData.filter(function (d) {
                return d.state === stateFilter;
            });
        }
        updateRegressionLine(d3.select(".chart"), filteredData, xScale, yScale);

        //reapply state filter opacity after transitions
        applyStateFilter(csvData);
    }
})(); //last line of main.js
