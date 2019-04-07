var vessels = [];
var selectedVessel;
var vesselNumbers = [];
var vesselFilter = [{
    key: "Type",
    value: vesselNumbers
}];
var invertFilter = false;

var allMetadata = [];
var vesselTypes = [];
var vesselDetails = [];

var bounds = [
    [4.18, 55.6], // Southwest coordinates
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

map.on('style.load', function () {
    document.getElementById("loading").classList.add("hidden");

    //map.getSource('Stations').setData(JSON.parse(GeoJSONstationsCollection(trainStations)));

    window.setInterval(function() {
        map.getSource('vessels').setData(JSON.parse(GeoJSONvesselCollection(vessels)));
        //map.flyTo({center: [allTrains[0].Long, allTrains[0].Lat]});
    }, 5000);

    map.addSource("vessels", {
        type: "geojson",
        data: JSON.parse(GeoJSONvesselCollection(vessels)),
        cluster: false,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 2.5 // Radius of each cluster when clustering points (defaults to 50)
    });
    map.addLayer({
        id: "Vessels",
        interactive: false,
        type: "circle",
        source: "vessels",
        "paint": {
            "circle-color": {
                property: "Type",
                stops: [
                    [0, "#727272"],
                    [10, "#ff2a27"],
                    [40, "#fffe2d"],
                    [50, "#4affeb"],
                    [60, "#5aff3c"],
                    [80, "#ffa509"],
                    [90, "#ff00f6"],
                    [99, "#3845ff"],
                    [100, "#d9cdff"]
                ]
            },
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
        map.addImage("vessel", image);
    });
    /* Style layer: A style layer ties together the source and image and specifies how they are displayed on the map. */
    /*map.addLayer({
        id: "Vessels",
        type: "symbol",
        /!* Source: A data source specifies the geographic coordinate where the image marker gets placed. *!/
        source: "vessels",
        layout: {
            "icon-image": "vessel",
            "icon-rotate": ["get", "Heading"],
            "icon-allow-overlap": true,
            "icon-offset": [0, -20],
            "icon-size": [
                "interpolate",
                ["linear"],
                ["zoom"],
                0.8,
                0.08,
                22,
                0.2
            ],
        }
    });*/
    map.addLayer({
        id: "vesselName",
        type: "symbol",
        source: "vessels",
        layout: {
            "text-field": "{Name}",
            "text-allow-overlap": false,
            "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
            "text-size": [
                "step",
                ["zoom"],
                8,
                8,
                10,
                10,
                14,
                15,
                16
            ]
        }
    });
    map.getSource('vessels').setData(JSON.parse(GeoJSONvesselCollection(vessels)));
});

HttpReq("https://meri.digitraffic.fi/api/v1/metadata/vessels", function () {
    allMetadata = JSON.parse(this.responseText);
});

HttpReq("https://meri.digitraffic.fi/api/v1/metadata/code-descriptions", function () {
    vesselTypes = JSON.parse(this.responseText).vesselTypes;

    let codes = [];
    vesselTypes.forEach(function (element) {
        codes.push(element.code);
    });
    getVesselDetails(codes);
});

function getVesselDetails(codes) {
    let ammount = codes.length;
    let ready = 0;
    codes.forEach(function (code) {
        HttpReq("https://meri.digitraffic.fi/api/v1/metadata/vessel-details?vesselTypeCode=" + code, function () {
            vesselDetails = vesselDetails.concat(JSON.parse(this.responseText));
            ready ++;
            if (ready === ammount) {
                updateType();
            }
        });
    });
}

function updateType() {
    vessels.forEach(function (element) {
        let index = searchVesselMetadata(vesselDetails, element.Mmsi);
        if (index !== -1) {
            element.Type = vesselDetails[index].vesselConstruction.vesselTypeCode;
        }
    });
}


let tries = 0;
//websocket: GPS-locations of all vessels and metadata

//Using the HiveMQ public Broker, with a random client Id
var client = new Paho.MQTT.Client("meri-test.digitraffic.fi", 61619, "myclientid_" + parseInt(Math.random() * 10000, 10));

//Gets  called if the websocket/mqtt connection gets disconnected for any reason
client.onConnectionLost = function(responseObject) {
    //Depending on your scenario you could implement a reconnect logic here

    //TODO: remove
    /*gtag('event', 'MQTT-error', {
        'event_category' : 'Error',
        'event_label' : 'Connection lost'
    });*/

    if (tries < 4) {
        console.log(tries);
        console.error("connection lost: " + responseObject.errorMessage);
        document.getElementById('connectionErrorHeader').innerText = 'Yhteys katkesi';
        document.getElementById('connectionErrorText').innerText = 'Yritetään yhdistää uudelleen...';
        document.getElementById('connectionError').classList.remove('hidden');
        console.log('Trying to connect again...');
        tries ++;
        client.connect(options);
    } else {
        let Links = document.getElementById("offCanvas");
        Links.classList.toggle("blur");
        Links = document.getElementById("topBar");
        Links.classList.toggle("blur");
        Links = document.getElementById("alertBox");
        Links.classList.toggle("hidden");
        document.getElementById('connectionError').classList.add('hidden');
    }
};


//Gets called whenever you receive a message for your subscriptions
client.onMessageArrived = function(message) {
    //console.log(message.destinationName);
    // locations
    if (message.destinationName.split("/")[2] === "locations") {
        parseVesselLocationMessage(message.payloadString, vessels);
    }

    // metadata
    if (message.destinationName.split("/")[2] === "metadata") {
        parseVesselMetadataMessage(message.payloadString, vessels);
    }
};

//Connect Options
var options = {
    timeout: 3,
    useSSL: true,
    userName:"digitraffic",
    password:"digitrafficPassword",
    //Gets Called if the connection has sucessfully been established
    onSuccess: function() {
        client.subscribe('vessels/#', {
            qos: 0
        });
        document.getElementById('connectionError').classList.add('hidden');
    },
    //Gets Called if the connection could not be established
    onFailure: function(message) {

        //TODO: remove
        /*gtag('event', 'MQTT-error', {
            'event_category' : 'Error',
            'event_label' : 'Connection could not establish'
        });*/


        document.getElementById('connectionErrorHeader').innerText = 'Yhteyden muodostamisessa ongelmia';
        document.getElementById('connectionErrorText').innerText = 'Yritetään uudelleen...';
        document.getElementById('connectionError').classList.remove('hidden');
        console.error("Connection failed: " + message.errorMessage);
        console.log('Trying to connect again...');
        tries ++;
        console.log('Tries: ' + tries);
        if (tries < 4) {
            client.connect(options);
        } else {
            console.error('Connection failed');

            let Links = document.getElementById("offCanvas");
            Links.classList.toggle("blur");
            Links = document.getElementById("topBar");
            Links.classList.toggle("blur");
            Links = document.getElementById("alertBox");
            Links.classList.toggle("hidden");
            document.getElementById('connectionError').classList.add('hidden');
        }
    }
};

client.connect(options);

map.on('click', 'Vessels', function (e) {
    if  (e.features[0].properties.Mmsi != undefined) {
        //updateSidePanelVessel(new Vessel("-", "-", "-", "-", "-", "", 0, 0, "", "", "-", 0, "", 0, "",
        // "Ladataan..."));
        let description = e.features[0].properties;
        selectedVessel = description.Mmsi;

        let index = searchVesselFromArray(selectedVessel, vessels);
        if (index != undefined) {
            //updateSidePanelHSL(vessels[index]);

            let detailsIndex = searchVesselMetadata(vesselDetails, selectedVessel);

            if (detailsIndex != -1) {
                updateVesselDetails(vesselDetails[detailsIndex]);
                $("#infoBox").removeClass("hidden");
            } else {
                updateVesselDetails({clear: true});
                $("#infoBox").addClass("hidden");
            }
        }

        var viewportWidth = $(window).width() / parseFloat($("html").css("font-size"));
        if (viewportWidth <= 64 ) {
            $("#offCanvasBottom").foundation('open');
        }
        document.getElementById('SeeMoreInfoText').classList.add('hidden');
        document.getElementById('gridLeft').classList.remove('hidden');
        resizeAllGridItems();
    }
});

$( "#filter0" ).prop( "checked", false);
$( "#filter10" ).prop( "checked", false);
$( "#filter20" ).prop( "checked", false);
$( "#filter30" ).prop( "checked", false);
$( "#filter40" ).prop( "checked", false);
$( "#filter44" ).prop( "checked", false);
$( "#filter50" ).prop( "checked", false);
$( "#filter60" ).prop( "checked", false);
$( "#filter70" ).prop( "checked", false);
$( "#filter80" ).prop( "checked", false);
$( "#filter81" ).prop( "checked", false);
$( "#filter82" ).prop( "checked", false);
$( "#filter83" ).prop( "checked", false);
$( "#filter90" ).prop( "checked", false);
$( "#filter91" ).prop( "checked", false);
$( "#filter93" ).prop( "checked", false);
$( "#filter94" ).prop( "checked", false);
$( "#filter95" ).prop( "checked", false);
$( "#filter96" ).prop( "checked", false);
$( "#filter97" ).prop( "checked", false);
$( "#filter99" ).prop( "checked", false);



$("#filter0").click(function() {
    $( "#filter10" ).prop( "checked", false);
    $( "#filter20" ).prop( "checked", false);
    $( "#filter30" ).prop( "checked", false);
    $( "#filter40" ).prop( "checked", false);
    $( "#filter44" ).prop( "checked", false);
    $( "#filter50" ).prop( "checked", false);
    $( "#filter60" ).prop( "checked", false);
    $( "#filter70" ).prop( "checked", false);
    $( "#filter80" ).prop( "checked", false);
    $( "#filter81" ).prop( "checked", false);
    $( "#filter82" ).prop( "checked", false);
    $( "#filter83" ).prop( "checked", false);
    $( "#filter90" ).prop( "checked", false);
    $( "#filter91" ).prop( "checked", false);
    $( "#filter93" ).prop( "checked", false);
    $( "#filter94" ).prop( "checked", false);
    $( "#filter95" ).prop( "checked", false);
    $( "#filter96" ).prop( "checked", false);
    $( "#filter97" ).prop( "checked", false);
    $( "#filter99" ).prop( "checked", false);
    vesselNumbers = [10, 20, 30, 40, 44, 50, 60, 70, 80, 81, 82, 83, 90, 91, 93, 94, 95, 96, 96, 99];
    vesselFilter[0].value = vesselNumbers;
    invertFilter = true;
    map.getSource('vessels').setData(JSON.parse(GeoJSONvesselCollection(vessels)));
});

$("#filter10").click(buttonClicked);
$( "#filter20" ).click(buttonClicked);
$( "#filter30" ).click(buttonClicked);
$( "#filter40" ).click(buttonClicked);
$( "#filter44" ).click(buttonClicked);
$( "#filter50" ).click(buttonClicked);
$( "#filter60" ).click(buttonClicked);
$( "#filter70" ).click(buttonClicked);
$( "#filter80" ).click(buttonClicked);
$( "#filter81" ).click(buttonClicked);
$( "#filter82" ).click(buttonClicked);
$( "#filter83" ).click(buttonClicked);
$( "#filter90" ).click(buttonClicked);
$( "#filter91" ).click(buttonClicked);
$( "#filter93" ).click(buttonClicked);
$( "#filter94" ).click(buttonClicked);
$( "#filter95" ).click(buttonClicked);
$( "#filter96" ).click(buttonClicked);
$( "#filter97" ).click(buttonClicked);
$( "#filter99" ).click(buttonClicked);

function buttonClicked() {
    $( "#filter0" ).prop( "checked", false);
    vesselNumbers = filterStringVessels();
    vesselFilter[0].value = vesselNumbers;
    invertFilter = false;
    map.getSource('vessels').setData(JSON.parse(GeoJSONvesselCollection(vessels)));
}