var selectedHSL;
var HSLarray = [];

var tries = 0;

var number = 0;
var test = setInterval(function () {
    console.log("messages: " + number + "/s");
    number = 0;
}, 1000);

var bounds = [
    [4.18, 56.6], // Southwest coordinates
    [47.5, 70.16]  // Northeast coordinates
];

mapboxgl.accessToken = 'pk.eyJ1Ijoibm9tYXRpdGkiLCJhIjoiY2pyYXJxZ2gzMGh1ZDRhcDg0cm1yeWMwOSJ9.eMg9ZbSoqz52OcI-NKXi3g';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/bright-v8',
    center: [24.941, 60.172],
    maxBounds: bounds
});

var nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');

map.addControl(new mapboxgl.GeolocateControl({
    positionOptions: {
        enableHighAccuracy: true
    },
    trackUserLocation: true
}));

map.on("load", function () {
    /* Image: An image is loaded and added to the map. */

});

map.on('style.load', function () {
    document.getElementById("loading").classList.add("hidden");

    window.setInterval(function() {
        map.getSource('HSL').setData(JSON.parse(GeoJSON_HSLCollection(HSLarray)));
    }, 1000);

    map.addSource("HSL", {
        type: "geojson",
         data: JSON.parse(GeoJSON_HSLCollection(HSLarray)),
        // cluster: true,
        // clusterMaxZoom: 14, // Max zoom to cluster points on
        // clusterRadius: 2.5 // Radius of each cluster when clustering points (defaults to 50)
    });
    map.loadImage("img/HSL-tram.png", function(error, image) {
        if (error) throw error;
        map.addImage("tram", image);
    });
    map.loadImage("img/HSL-train.png", function(error, image) {
        if (error) throw error;
        map.addImage("train", image);
    });
    map.loadImage("img/HSL-other.png", function(error, image) {
        if (error) throw error;
        map.addImage("other", image);
    });
    map.loadImage("img/HSL-lightblue.png", function(error, image) {
        if (error) throw error;
        map.addImage("bus", image);
        /* Style layer: A style layer ties together the source and image and specifies how they are displayed on the map. */
        map.addLayer({
            id: "HSL",
            type: "symbol",
            /* Source: A data source specifies the geographic coordinate where the image marker gets placed. */
            source: "HSL",
            layout: {
                "icon-image": [
                    "match",
                    ["get", "Type"],
                    "Bussi", "bus",
                    "Raitiovaunu", "other",
                    "Lähijuna", "train",
                    "metro", "tram",
                    "other",
                ],
                "text-field": "{Desi}",
                "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
                "text-size": [
                    "step",
                    ["zoom"],
                    0,
                    8,
                    4,
                    10,
                    10,
                    15,
                    15
                ],
                "text-allow-overlap": true,
                "icon-rotate": ["get", "Hdg"],
                "icon-allow-overlap": true,
                "icon-offset": [0, -20],
                "icon-size": [
                    "interpolate",
                    ["linear"],
                    ["zoom"],
                    0.8,
                    0.1,
                    22,
                    0.2
                ],
            }
        });
    });
    /*map.addLayer({
        id: "HSL",
        interactive: false,
        type: "circle",
        source: "HSL",
        "paint": {
            "circle-color": [
                "match",
                ["get", "Type"],
                "Bussi", "#79A0C7",
                "Raitiovaunu", "#ff6c3f",
                "Lähijuna", "#65ff61",
                /!* other *!/ "#fff591"
            ],
            "circle-stroke-width": 3,
            "circle-stroke-color": "#ffffff",
            "circle-radius": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0.8,
                10,
                6,
                11,
                22,
                10
            ]
        }
    });*/
    /*map.addLayer({
        id: "arrows",
        type: "symbol",
        source: "HSL",
        layout: {
            "icon-image": "triangle-11",
            "icon-size": 0.25
        }
    });
    map.addLayer({
        id: "Type",
        type: "symbol",
        source: "HSL",
        layout: {
            "text-field": "{Desi}",
            "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
            "text-size": 8
        }
    });*/
});

var topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/3/#';

const client  = mqtt.connect('wss://mqtt.hsl.fi:443');

client.on('connect', function () {
    client.subscribe(topic);
    console.log('Connected');
});

let count = 0;

client.on('message', function (topic, message) {
    number ++;
    const Message = JSON.parse(message);
    const vehicle_position = Message[Object.keys(Message)[0]];

    //Skip vehicles with invalid location
    if (!vehicle_position.lat || !vehicle_position.long) {
        return;
    }

    updateHSLarray(vehicle_position, topic, HSLarray);
});

client.on('close', function () {
    console.log( ' disconnected');
    client.end(true);

    let Links = document.getElementById("offCanvas");
    Links.classList.toggle("blur");
    Links = document.getElementById("topBar");
    Links.classList.toggle("blur");
    Links = document.getElementById("alertBox");
    Links.classList.toggle("hidden");
    document.getElementById('connectionError').classList.add('hidden');
})

$( "#6" ).prop( "checked", false);
$( "#5" ).prop( "checked", false);
$( "#4" ).prop( "checked", false);
$( "#3" ).prop( "checked", true);
$( "#2" ).prop( "checked", false);
$( "#1" ).prop( "checked", false);
$( "#0" ).prop( "checked", false);

$("#6").click(function() {
    $( "#5" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 0");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/0/#';
    client.subscribe(topic);
});
$("#5").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 1");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/1/#';
    client.subscribe(topic);
});
$("#4").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#5" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 2");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/2/#';
    client.subscribe(topic);
});
$("#3").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#5" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 3");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/3/#';
    client.subscribe(topic);
});
$("#2").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#5" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 4");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/4/#';
    client.subscribe(topic);
});
$("#1").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#5" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#0" ).prop( "checked", false);
    console.log("Geohash level: 5");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/5/#';
    client.subscribe(topic);
});
$("#0").click(function() {
    $( "#6" ).prop( "checked", false);
    $( "#5" ).prop( "checked", false);
    $( "#4" ).prop( "checked", false);
    $( "#3" ).prop( "checked", false);
    $( "#2" ).prop( "checked", false);
    $( "#1" ).prop( "checked", false);
    console.log("Geohash level: +");
    client.unsubscribe(topic);
    topic = '/hfp/v2/journey/ongoing/+/+/+/+/+/+/+/+/+/+/#';
    client.subscribe(topic);
});

//Detect when user click on some train
map.on('click', 'HSL', function (e) {
    if  (e.features[0].properties.Identifier != undefined) {
        updateSidePanelHSL(new HSL("-", "-", "-", "-", "-", "", 0, 0, "", "", "-", 0, "", 0, "", "Ladataan..."));
        var description = e.features[0].properties;
        selectedHSL = description.Identifier;

        let index = searchHSLFromArray(selectedHSL, HSLarray);
        if (index != undefined) {
            updateSidePanelHSL(HSLarray[index]);
        }

        var viewportWidth = $(window).width() / parseFloat($("html").css("font-size"));
        if (viewportWidth <= 64 ) {
            $("#offCanvasBottom").foundation('open');
        }
        document.getElementById('SeeMoreInfoText').classList.add('hidden');
        document.getElementById('gridLeft').classList.remove('hidden');
        resizeAllGridItems();
        console.log(selectedHSL);
    }
});



$(window).on('resize', function(){
    var viewportWidth = $(window).width() / parseFloat($("html").css("font-size"));
    if (viewportWidth >= 64) {
        $("#offCanvasBottom").foundation('close');

        //Copy to left off-canvas
        let bottom = document.getElementById('gridBottom');
        if (bottom.innerHTML != '') {
            let left = document.getElementById('gridLeft').innerHTML = bottom.innerHTML;
            bottom.innerHTML = '';
        }
    } else {
        //Copy to bottom off-canvas
        let left = document.getElementById('gridLeft');
        if (left.innerHTML != '') {
            let bottom = document.getElementById('gridBottom').innerHTML = left.innerHTML;
            left.innerHTML = '';
        }
    }
});

var removeOld = setInterval(removeOldTrains(HSLarray), 120000);


