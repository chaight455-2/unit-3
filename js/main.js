//begin script when window loads
window.onload = setMap();

//set up choropleth map
function setMap() {
    //map frame dimensions
    var width = 960,
        height = 600;

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
        .scale(4200)
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

        //add counties to map
        var countyPaths = map
            .selectAll(".county")
            .data(counties)
            .enter()
            .append("path")
            .attr("class", function (d) {
                return "county " + d.id;
            })
            .attr("d", path);

        console.log(csvData);
        console.log(counties);
    }
}
