var cityPop = [
    {
        city: 'Madison',
        population: 233209
    },
    {
        city: 'Milwaukee',
        population: 594833
    },
    {
        city: 'Green Bay',
        population: 104057
    },
    {
        city: 'Superior',
        population: 27244
    }
];

// SVG dimensions and margins
var margin = { top: 40, right: 60, bottom: 60, left: 100 };
var width = 810 - margin.left - margin.right;
var height = 500 - margin.top - margin.bottom;

// Create SVG container
var svg = d3.select("body")
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom);

var container = svg.append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

// Y scale — 0 to 700,000
var yScale = d3.scaleLinear()
    .domain([0, 700000])
    .range([height, 0]);

// Color scale
var color = d3.scaleOrdinal()
    .domain(cityPop.map(function(d) { return d.city; }))
    .range(["#4e79a7", "#f28e2b", "#59a14f", "#e15759"]);

// Draw Y axis
container.append("g")
    .call(
        d3.axisLeft(yScale)
            .tickFormat(function(d) { return d / 1000 + "k"; })
    )
    .selectAll("text")
    .style("font-size", "12px");

// Y axis label
container.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -height / 2)
    .attr("y", -70)
    .attr("text-anchor", "middle")
    .style("font-family", "sans-serif")
    .style("font-size", "14px")
    .text("Population");

// Example 2.6 line 3
var circles = container.selectAll(".circles") //create an empty selection
    .data(cityPop) //here we feed in an array
    .enter() //one of the great mysteries of the universe
    .append("circle") //inspect the HTML--holy crap, there's some circles there
    .attr("class", "circles")
    .attr("id", function(d){
        return d.city;
    })
    .attr("r", function(d){
        //calculate the radius based on population value as circle area
        var area = d.population * 0.01;
        return Math.sqrt(area/Math.PI);
    })
    .attr("cx", function(d, i){
        //use the index to place each circle horizontally
        return 90 + (i * 180);
    })
    .attr("cy", function(d){
        //use the yScale to position circles by population
        return yScale(d.population);
    })
    .attr("fill", function(d) { return color(d.city); })
    .attr("opacity", 0.8)
    .attr("stroke", "#333")
    .attr("stroke-width", 1.5);

// Add city name labels below each circle
container.selectAll(".labels")
    .data(cityPop)
    .enter()
    .append("text")
    .attr("class", "labels")
    .attr("text-anchor", "middle")
    .attr("x", function(d, i){
        return 90 + (i * 180);
    })
    .attr("y", height + 30)
    .style("font-family", "sans-serif")
    .style("font-size", "12px")
    .text(function(d) { return d.city; });

// Add population labels inside bubbles
container.selectAll(".pop-labels")
    .data(cityPop)
    .enter()
    .append("text")
    .attr("class", "pop-labels")
    .attr("text-anchor", "middle")
    .attr("x", function(d, i){
        return 90 + (i * 180);
    })
    .attr("y", function(d){
        return yScale(d.population) + 5;
    })
    .attr("dx", function(d){
        var area = d.population * 0.01;
        return Math.sqrt(area/Math.PI) + 5;
    })
    .style("font-family", "sans-serif")
    .style("font-size", "11px")
    .style("font-weight", "bold")
    .style("fill", "#333")
    .attr("text-anchor", "start")
    .text(function(d) {
        return d.population.toLocaleString();
    });
