function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
    vars[key] = value;
  });
  return vars;
}

var selectedTrain = getUrlVars('train').train;
var trainStations = [];
var allTrains = [];

var Syyluokat;
var Syykoodit;
var KolmannenTasonSyykoodit;

let tries = 0;

var bounds = [
  [5.58, 58.6], // Southwest coordinates
  [41.9, 70.16]  // Northeast coordinates
];

mapboxgl.accessToken = 'pk.eyJ1Ijoibm9tYXRpdGkiLCJhIjoiY2pyYXJxZ2gzMGh1ZDRhcDg0cm1yeWMwOSJ9.eMg9ZbSoqz52OcI-NKXi3g';
var map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/bright-v8',
  zoom: 8.8,
  center: [24.941, 60.172],
  maxBounds: bounds,
  interactive: false
});

var nav = new mapboxgl.NavigationControl();
map.addControl(nav, 'top-left');

map.on('style.load', function () {
  // document.getElementById("loading").classList.add("hidden");

  map.addSource('Stations', {type: "geojson", data: JSON.parse(GeoJSONstationsCollection(trainStations))});
  map.addLayer({
    id: "Stations",
    type: "symbol",
    source: 'Stations',
    layout: {
      "icon-image": "circle-11",
      "text-field": "{name}",
      "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
      "text-offset": [0, 0.6],
      "text-anchor": "top",
      "text-size": 8
    }
  });

  map.getSource('Stations').setData(JSON.parse(GeoJSONstationsCollection(trainStations)));

  window.setInterval(function() {
    map.getSource('Trains').setData(JSON.parse(GeoJSONtrainsCollection(allTrains)));
    try {
      map.flyTo({center: [allTrains[0].Long, allTrains[0].Lat]});
    }
    catch (e) {
      console.log('Train data has not loaded yet...');
    }
  }, 1000);

  map.addSource("Trains", {
    type: "geojson",
    data: JSON.parse(GeoJSONtrainsCollection(allTrains)),
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
      "circle-color": "#ff6f59",
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
    id: "trainNumbers",
    type: "symbol",
    source: "Trains",
    layout: {
      "text-field": "{TrainNumber}",
      "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
      "text-size": 8
    }
  });
});

//websocket: GPS-locations of all trains

//Using the HiveMQ public Broker, with a random client Id
var client = new Paho.MQTT.Client("rata.digitraffic.fi", 443, "myclientid_" + parseInt(Math.random() * 10000, 10));

//Gets  called if the websocket/mqtt connection gets disconnected for any reason
client.onConnectionLost = function(responseObject) {
  //Depending on your scenario you could implement a reconnect logic here
};

//Gets called whenever you receive a message for your subscriptions
client.onMessageArrived = function(message) {
  // train-locations/
  if (message.destinationName.slice(0, 16) == "train-locations/") {
    parseTrainLocationMessage(message.payloadString, allTrains);
    document.getElementById('map').classList.remove('blurred');
  }

  // trains/
  if (message.destinationName.slice(0, 7) == "trains/") {
    parseTrainMessage(message.payloadString, false);
    resizeAllGridItems();
  }
};

//Connect Options
var options = {
  timeout: 3,
  useSSL: true,
  //Gets Called if the connection has sucessfully been established
  onSuccess: function() {
    client.subscribe('train-locations/+/' + selectedTrain + '/#', {
      qos: 0
    });
    client.subscribe('trains/+/' + selectedTrain + '/#', {
      qos: 0
    });
  },
  //Gets Called if the connection could not be established
  onFailure: function(message) {
    console.log(message);
  }
};

client.connect(options);

HttpReq("https://rata.digitraffic.fi/api/v1/trains/latest/" + selectedTrain, firstTime);

HttpReq("https://rata.digitraffic.fi/api/v1/metadata/cause-category-codes", function () {
  Syyluokat = JSON.parse(this.responseText);
});

HttpReq("https://rata.digitraffic.fi/api/v1/metadata/detailed-cause-category-codes", function () {
  Syykoodit = JSON.parse(this.responseText);
});

HttpReq("https://rata.digitraffic.fi/api/v1/metadata/third-cause-category-codes", function () {
  KolmannenTasonSyykoodit = JSON.parse(this.responseText);
});

function firstTime() {
  parseTrainMessage(this.responseText, true);
  updateInfoBox(this.responseText);

  let departure = new Date(JSON.parse(this.responseText)[0].departureDate);
  let month = departure.getMonth().toString();
  HttpReq("https://rata.digitraffic.fi/api/v1/compositions/" + departure.getFullYear() + "-" + (departure.getMonth() +1).toString().padStart(2, "0") + "-" +departure.getDate().toString().padStart(2, "0") + "/" + selectedTrain, composition);
  resizeAllGridItems();
}

function composition() {
  let composition = parseComposition(this.responseText);
  createCompositionTables('compositionDiv', composition);
  resizeAllGridItems();
}

if (selectedTrain != undefined) {
  document.title = 'Liikenne.live - Juna ' + selectedTrain;
}

HttpReq("https://rata.digitraffic.fi/api/v1/train-locations/latest/" + selectedTrain, function () {
  parseTrainLocationMessage(JSON.stringify(JSON.parse(this.responseText)[0]), allTrains);
  document.getElementById('map').classList.remove('blurred');
});

//Hide/show stations layer
document.getElementById("stationsCheck").onclick = function () {
  if (this.checked) {
    map.setLayoutProperty("Stations", 'visibility', 'visible');
  } else {
    map.setLayoutProperty("Stations", 'visibility', 'none');
  }
};