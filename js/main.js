//wrap everything in a self-executing anonymous function to move to local scope
(function () {
    //pseudo-global variables
    var attrArray = [
        "premature_death_ypll_rate",
        "pm25_avg_concentration",
        "pct_excessive_drinking",
        "pct_rural",
        "food_environment_index",
        "pct_severe_housing_problems",
        "avg_poor_physical_health_days",
        "avg_poor_mental_health_days",
        "pct_food_insecure",
    ];
    //create an object for different expressed variables
    var expressed = {
        x: attrArray[1], //x attribute: pm25_avg_concentration
        y: attrArray[0], //y attribute: premature_death_ypll_rate
        color: attrArray[8], //color/size attribute: pct_food_insecure
    };

    //begin script when window loads
    window.onload = setMap;

    //set up choropleth map
    function setMap() {
        //map frame dimensions
        var width = window.innerWidth * 0.5 - 25,
            height = 460;

        //create new svg container for the map
        var map = d3
            .select("body")
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
                return "county " + d.id;
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
            });
    }

    //function to create coordinated bubble chart
    function setChart(csvData, colorScale) {
        //chart frame dimensions
        var chartWidth = window.innerWidth * 0.5 - 25,
            chartHeight = 460,
            leftPadding = 70,
            rightPadding = 20,
            topPadding = 20,
            bottomPadding = 60;

        //create a second svg element to hold the bubble chart
        var chart = d3
            .select("body")
            .append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "chart");

        //create scales
        var yScale = createYScale(csvData, chartHeight, topPadding, bottomPadding);
        var xScale = createXScale(csvData, chartWidth, leftPadding, rightPadding);

        //set circles for each county
        var circles = chart
            .selectAll(".bubble")
            .data(csvData)
            .enter()
            .append("circle")
            .attr("class", function (d) {
                return "bubble " + d.fips;
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
            });

        //create axes
        createChartAxes(chart, chartWidth, chartHeight, leftPadding, bottomPadding, yScale, xScale);
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

    //function to create y scale
    function createYScale(csvData, chartHeight, topPadding, bottomPadding) {
        var dataMinMax = getDataValues(csvData, expressed.y);
        return d3
            .scaleLinear()
            .range([topPadding, chartHeight - bottomPadding])
            .domain([dataMinMax[1], dataMinMax[0]]);
    }

    //function to create x scale
    function createXScale(csvData, chartWidth, leftPadding, rightPadding) {
        var dataMinMax = getDataValues(csvData, expressed.x);
        return d3
            .scaleLinear()
            .range([leftPadding, chartWidth - rightPadding])
            .domain([dataMinMax[0], dataMinMax[1]]);
    }

    //create axes
    function createChartAxes(chart, chartWidth, chartHeight, leftPadding, bottomPadding, yScale, xScale) {
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
            .attr("class", "axisLabel")
            .attr("transform", "rotate(-90)")
            .attr("x", -chartHeight / 2)
            .attr("y", 15)
            .attr("text-anchor", "middle")
            .text(expressed.y);

        //x-axis label
        chart
            .append("text")
            .attr("class", "axisLabel")
            .attr("x", chartWidth / 2)
            .attr("y", chartHeight - 10)
            .attr("text-anchor", "middle")
            .text(expressed.x);
    }
})(); //last line of main.js
