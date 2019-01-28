var selectedTrain;
var selectedTrainInfo;
var selectedTrainStations = [];
var selectedTrainComposition = [];
var trainStations = [];
var allTrains = [];

var tries = 0;



var bounds = [
  [4.18, 58.6], // Southwest coordinates
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


  map.addSource('Stations', {type: "geojson", data: JSON.parse(GeoJSONstationsCollection(trainStations))});
  map.addLayer({
    id: "Stations",
    type: "symbol",
    source: 'Stations',
    layout: {
      "icon-image": "circle-11",
      "text-field": "{name}",
      "text-font": ["Open Sans Semibold", "Arial Unicode MS Bold"],
      "text-offset": [0, 0.6],
      "text-anchor": "top",
      "text-size": 8
    }
  });

  //map.getSource('Stations').setData(JSON.parse(GeoJSONstationsCollection(trainStations)));

  window.setInterval(function() {
    map.getSource('Trains').setData(JSON.parse(GeoJSONtrainsCollection(allTrains)));
    //map.flyTo({center: [allTrains[0].Long, allTrains[0].Lat]});
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
      "text-font": ["Open Sans Regular", "Arial Unicode MS Bold"],
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

  gtag('event', 'MQTT-error', {
    'event_category' : 'Error',
    'event_label' : 'Connection lost'
  });

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
  // train-locations/
  if (message.destinationName.slice(0, 16) == "train-locations/") {
    parseTrainLocationMessage(message.payloadString, allTrains);
  }

  // trains/
  if (message.destinationName.slice(0, 7) == "trains/") {
    parseTrainMessage(message.payloadString, false);

  }
};

//Connect Options
var options = {
  timeout: 3,
  useSSL: true,
  //Gets Called if the connection has sucessfully been established
  onSuccess: function() {
    client.subscribe('train-locations/#', {
      qos: 0
    });
    document.getElementById('connectionError').classList.add('hidden');
  },
  //Gets Called if the connection could not be established
  onFailure: function(message) {

    gtag('event', 'MQTT-error', {
      'event_category' : 'Error',
      'event_label' : 'Connection could not establish'
    });


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




//Detect when user click on some train
map.on('click', 'Trains', function (e) {
  client.unsubscribe("trains/+/" + selectedTrain + "/#");
  var description = e.features[0].properties;
  selectedTrain = description.TrainNumber;
  trainClicked();
  console.log('Clicked train: ' + selectedTrain);
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


function trainClicked() {
  selectedTrainComposition = [];
  selectedTrainInfo = [];
  selectedTrainStations = [];

  var viewportWidth = $(window).width() / parseFloat($("html").css("font-size"));
  if (viewportWidth <= 64 ) {
    $("#offCanvasBottom").foundation('open');
  }
  document.getElementById('SeeMoreInfoText').classList.add('hidden');
  document.getElementById('gridLeft').classList.remove('hidden');

    document.getElementById("speed").innerHTML = "-";
  HttpReq("https://rata.digitraffic.fi/api/v1/trains/latest/" + selectedTrain, firstTime);
  client.subscribe('trains/+/' + selectedTrain + '/#', {
    qos: 0
  });

  resizeAllGridItems();

}


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

var removeOld = setInterval(removeOldTrains(allTrains), 30000);

function moreInfoPressed() {
  window.location = './juna.html?train=' + selectedTrain;
}

//Hide/show stations layer
document.getElementById("stationsCheck").onclick = function () {
  if (this.checked) {
    map.setLayoutProperty("Stations", 'visibility', 'visible');
  } else {
    map.setLayoutProperty("Stations", 'visibility', 'none');
  }
};