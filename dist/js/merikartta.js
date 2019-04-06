var vessels = [];

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
        map.getSource('Trains').setData(JSON.parse(GeoJSONvesselCollection(vessels)));
        //map.flyTo({center: [allTrains[0].Long, allTrains[0].Lat]});
    }, 1000);

    map.addSource("Trains", {
        type: "geojson",
        data: JSON.parse(GeoJSONvesselCollection(vessels)),
        cluster: true,
        clusterMaxZoom: 14, // Max zoom to cluster points on
        clusterRadius: 2.5 // Radius of each cluster when clustering points (defaults to 50)
    });
    map.addLayer({
        id: "Trains",
        interactive: false,
        type: "circle",
        source: "Trains",
        "paint": {
            "circle-color": "#469eff",
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
    map.addLayer({
        id: "vesselName",
        type: "symbol",
        source: "Trains",
        layout: {
            "text-field": "{Mmsi}",
            "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
            "text-size": 8
        }
    });
});

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

var x = true;
var y = 0;

//Gets called whenever you receive a message for your subscriptions
client.onMessageArrived = function(message) {
    //console.log(message.destinationName);
    // locations
    if (message.destinationName.split("/")[2] === "locations") {
        parseVesselLocationMessage(message.payloadString, vessels);
        if (y < 10) {
            console.log(vessels);
            y++;
        }
    }

    // metadata
    if (message.destinationName.split("/")[2] === "metadata") {
        //parseTrainMessage(message.payloadString, false);
    }
    if (x==true) {
        console.log(message.destinationName);
        console.log(message.payloadString);
        x=false;
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