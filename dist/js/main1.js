var selectedTrain;
var selectedTrainInfo;
var selectedTrainStations = [];
var selectedTrainComposition = [];
var trainStations = [];
var allTrains = [];




function changeMap(style) {
  switch (style) {
    case 'railwayMap':
      document.getElementById('styles-toggle').setAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/nomatiti/cjh3f0hvg0v572spc6pnol7yj');
      break;
    case 'streets':
      document.getElementById('styles-toggle').setAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/mapbox/streets-v9');
      break;
    case 'bright':
      document.getElementById('styles-toggle').setAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/mapbox/bright-v9');
      break;
    case 'satellite':
      document.getElementById('styles-toggle').setAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v9');
      break;
    case 'Light':
      document.getElementById('styles-toggle').removeAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/mapbox/light-v9');
      document.getElementById('light-style').setAttribute('class', 'active');
      document.getElementById('dark-style').removeAttribute('class', 'active');
      break;
    case 'Dark':
      document.getElementById('styles-toggle').removeAttribute('style', 'display: none');
      map.setStyle('mapbox://styles/mapbox/dark-v9');
      document.getElementById('light-style').removeAttribute('class', 'active');
      document.getElementById('dark-style').setAttribute('class', 'active');
      break;
    default:
      break;
  }
}

//Hide/show stations layer
document.getElementById("stationsCheck").onclick = function () {
  if (this.checked) {
    map.setLayoutProperty("Stations", 'visibility', 'visible');
  } else {
    map.setLayoutProperty("Stations", 'visibility', 'none');
  }
};


//object constructor functions
function compositionJourneySection(wagons, maxSpeed, length, from, to) {
  this.wagons = wagons;
  this.maxSpeed = maxSpeed;
  this.length = length;
  this.from = from;
  this.to = to;
}

function compositionJourneySectionNew(locos, wagons, maxSpeed, length, from, to) {
  this.locos = locos;
  this.wagons = wagons;
  this.maxSpeed = maxSpeed;
  this.length = length;
  this.from = from;
  this.to = to;
}

function Wagon(type, playground, video, disabledperson, catering, pet, luggage, smoking, dieselLoco, electricLoco, position) {
  this.type = type;
  this.playground = playground;
  this.video = video;
  this.disabledPerson = disabledperson;
  this.catering = catering;
  this.pet = pet;
  this.luggage = luggage;
  this.smoking = smoking;
  this.dieselLoco = dieselLoco;
  this.electricLoco = electricLoco;
  this.position = position;
}

function WagonNew(type, palvelut, position) {
  this.type = type;
  this.palvelut = palvelut;
  this.position = position;
}

function Station(arrives, schedArrival, leaves, schedLeaving, stationName, passed, difference) {
  this.arrives = arrives;
  this.schedArrival = schedArrival;
  this.leaves = leaves;
  this.schedLeaving = schedLeaving;
  this.stationName = stationName;
  this.passed = passed;
  this.difference = difference;
}

function Train(trainNumber, trainCategory, Speed, Lat, Long, Time) {
  this.trainNumber = trainNumber;
  this.trainCategory = trainCategory;
  this.Speed = Speed;
  this.Lat = Lat;
  this.Long = Long;
  this.Time = new Date(Time);
}

function TrainInfo(trainNumber, departureDate, operator, trainType, trainCategory, commuterLine, stations) {
  this.trainNumber = trainNumber;
  this.departureDate = departureDate;
  this.operator = operator;
  this.trainType = trainType;
  this.trainCategory = trainCategory;
  this.commuterLine = commuterLine;
  this.stations = stations;
}

//HttpReq function
function HttpReq(url, func) {
  let oReq = new XMLHttpRequest();
  oReq.addEventListener("load", func);
  oReq.open("GET", url);
  oReq.send();
}


//GeoJSON creating
function GeoJSONgeometry(lat, long) {
  //let geometry = '"geometry":{\n"type":"point",\n"coordinates":[' + lat + ',' + long + ']' ;
  let geometry = JSON.stringify({type: "Point", coordinates: [long, lat]});
  return geometry;
}

function GeoJSONtrain(object) {
  let feature = '{"type":"Feature","properties":{"TrainNumber":' + object.trainNumber + ',"category":"' + object.trainCategory + '","speed":' + object.Speed + '},"geometry":' + GeoJSONgeometry(object.Lat, object.Long) + '}';
  return feature;
}

function GeoJSONstation(object) {
  let feature = '{\n"type":"Feature",\n"properties":{\n"name":"' + object.stationName + '",\n"marker-color":' + '"blue"' + ',\n"line":' + '"blue"' + '\n},' + '"geometry":' + GeoJSONgeometry(object.latitude, object.longitude) + '}';
  return feature;
}

function GeoJSONtrainsCollection(array) {
  let JSON = '{"type":"FeatureCollection","features":[';
  if (array.length != 0) {
    JSON = JSON + GeoJSONtrain(array[0]);
    for (var i = 1; i < array.length; i++) {
      JSON = JSON + "," + GeoJSONtrain(array[i]);
    }
  }
  JSON = JSON + ']}';
  return JSON;
}

function GeoJSONstationsCollection(array) {
  let JSON = '{"type":"FeatureCollection",\n"features": [';
  var x = 0;
  if (trainStations.length != 0) {
    while (x < array.length -1) {
      if (array[x].passengerTraffic == true) {
        JSON = JSON + GeoJSONstation(array[0]);
        x++;
        break;
      }
      x++;
    }
    for (var i = x; i < array.length; i++) {
      if (array[i].passengerTraffic == true) {
        JSON = JSON + "," + GeoJSONstation(array[i]);
      }
    }
  }
  JSON = JSON + ']}';
  return JSON;
}



//websocket: GPS-locations of all trains

//Using the HiveMQ public Broker, with a random client Id
var client = new Messaging.Client("rata-mqtt.digitraffic.fi", 9001, "myclientid_" + parseInt(Math.random() * 10000, 10));

//Gets  called if the websocket/mqtt connection gets disconnected for any reason
client.onConnectionLost = function(responseObject) {
  //Depending on your scenario you could implement a reconnect logic here
  alert("connection lost: " + responseObject.errorMessage);
};

//Gets called whenever you receive a message for your subscriptions
client.onMessageArrived = function(message) {
  // train-locations/
  if (message.destinationName.slice(0, 16) == "train-locations/") {
    UpdateTrainsArray(JSON.parse(message.payloadString));
  }

  // trains/
  if (message.destinationName.slice(0, 7) == "trains/") {
    //console.log(JSON.parse(message.payloadString));
    updateTrainInfoWhenArrives(message.payloadString);
  }
};

//Connect Options
var options = {
  timeout: 3,
  //Gets Called if the connection has sucessfully been established
  onSuccess: function() {
    client.subscribe('train-locations/#', {
      qos: 0
    });
  },
  //Gets Called if the connection could not be established
  onFailure: function(message) {
    alert("Connection failed: " + message.errorMessage);
  }
};

client.connect(options);


//HttpReq stations
HttpReq("https://rata.digitraffic.fi/api/v1/metadata/stations", function () {
  trainStations = JSON.parse(this.responseText);
  map.getSource('Stations').setData(JSON.parse(GeoJSONstationsCollection(trainStations)));
});

//TrainArray update
function UpdateTrainsArray(message) {
  let train = new Train(message.trainNumber, "q", message.speed, message.location.coordinates[1], message.location.coordinates[0], Date.now());

  if (train.trainNumber == selectedTrain) {
    document.getElementById("speed").innerHTML = train.Speed;
  }

  //Check if train is already in the array
  let position = SearchTrain(message.trainNumber);

  if (position=== undefined) {
    allTrains.push(train);
  } else {
    allTrains[position] = train;
  }
  removeOldTrains()
  //too slow when it updates every time
  //map.getSource('Trains').setData(JSON.parse(GeoJSONtrainsCollection(allTrains)));
}

//Search for a train and returns its position in array
function SearchTrain(number) {
  for (i = 0; i < allTrains.length -1; i++) {
    if (allTrains[i].trainNumber === number){
      return i;
    }
  }
}

//Remove one minute old trains
function removeOldTrains() {
  var time = Date.now();
  time -= 60000;
  time = new Date(time);
  allTrains.forEach(function (item, index) {
    if (item.Time <= time) {
      allTrains.splice(index, 1);
    }
  });
}


//Detect when user click on some train
map.on('click', 'Trains', function (e) {
  client.unsubscribe("trains/+/" + selectedTrain + "/#");
  var description = e.features[0].properties;
  selectedTrain = description.TrainNumber;
  trainClicked()
});

function trainClicked() {
  selectedTrainComposition = [];
  selectedTrainInfo = [];
  selectedTrainStations = [];

  var viewportWidth = window.innerWidth || document.documentElement.clientWidth;
  if (viewportWidth >= 40 )
    //$("#offCanvasLeftSplit2").foundation('open');
  document.getElementById("speed").innerHTML = "-";
  HttpReq("https://rata.digitraffic.fi/api/v1/trains/latest/" + selectedTrain, updateTrainInfoFirstTime);
  client.subscribe('trains/+/' + selectedTrain + '/#', {
    qos: 0
  });

}

//Update the sidepanel for the first time
function updateTrainInfoFirstTime() {
  let response = JSON.parse(this.responseText);
  //console.log(response);
  selectedTrainInfo = new TrainInfo(response[0].trainNumber, new Date(response[0].departureDate), response[0].operatorShortCode, response[0].trainType, response[0].trainCategory, true, response[0].timeTableRows);
  console.log(response[0].timeTableRows);
  selectedTrainStations = parseStations(response[0].timeTableRows);
  updateTimetable();

  document.getElementById("mistämihin").innerHTML = selectedTrainStations[0].stationName + " - " + selectedTrainStations[selectedTrainStations.length - 1].stationName;
  document.getElementById("trainNumber").innerHTML = selectedTrainInfo.trainType + " " + selectedTrainInfo.trainNumber;
  document.getElementById("mistämihin").innerHTML = selectedTrainStations[0].stationName + " - " + selectedTrainStations[selectedTrainStations.length - 1].stationName;
  let departure = selectedTrainInfo.departureDate;
  let month = departure.getMonth().toString();
  HttpReq("https://rata.digitraffic.fi/api/v1/compositions/" + departure.getFullYear() + "-" + (departure.getMonth() +1).toString().padStart(2, "0") + "-" +departure.getDate().toString().padStart(2, "0") + "/" + selectedTrain, parseComposition);
}

//Update the sidepanel after that
function updateTrainInfoWhenArrives(responseText) {
  let response = JSON.parse(responseText);
  //console.log(response);
  selectedTrainInfo = new TrainInfo(response.trainNumber, new Date(response.departureDate), response.operatorShortCode, response.trainType, response.trainCategory, true, response.timeTableRows);

  selectedTrainStations = parseStations();

  updateTimetable();
}

function UICtoStationName(UICCode) {
  function findStation(element) {
    return element.stationUICCode == UICCode;
  }
  let index = trainStations.findIndex(findStation);
  //return UICCode;
  return trainStations[index].stationName.replace("asema", "");
}

/*function parseStations() {

  let parsedStations = [];
  let arrives;
  let leaves;

  //Go trough stations
  for (var i = 0; i < selectedTrainInfo.stations.length; i++) {
    //Filter stations in wich the train stops
    if (selectedTrainInfo.stations[i].trainStopping === true) {
      //Check if last item so doesn't get [i+1] is undefined error
      if (i >= selectedTrainInfo.stations.length -1) {
        //If no actual time   train hasn't that station
        if (selectedTrainInfo.stations[i].actualTime == null) {
          passed = false;
          arrives = selectedTrainInfo.stations[i].liveEstimateTime;
          //Train has passed that station
        } else {
          passed = true;
          arrives = selectedTrainInfo.stations[i].actualTime;
        }
        parsedStations.push(new Station(arrives, selectedTrainInfo.stations[i].scheduledTime, NaN, NaN, UICtoStationName(selectedTrainInfo.stations[i].stationUICCode), passed));
      } else {
        //Arrival and departure are separate on the array so check if the second is the same
        //Which means that the first is arrival and second departure
        if (selectedTrainInfo.stations[i].stationUICCode === selectedTrainInfo.stations[i + 1].stationUICCode) {
          if (selectedTrainInfo.stations[i].actualTime == null) {
            passed = false;
            arrives = selectedTrainInfo.stations[i].liveEstimateTime;
          } else {
            passed = true;
            arrives = selectedTrainInfo.stations[i].actualTime;
          }
          if (selectedTrainInfo.stations[i + 1].actualTime == null) {
            leaves = selectedTrainInfo.stations[i + 1].liveEstimateTime;
          } else {
            leaves = selectedTrainInfo.stations[i + 1].actualTime;
          }
          parsedStations.push(new Station(arrives, selectedTrainInfo.stations[i].scheduledTime, leaves, selectedTrainInfo.stations[i + 1].scheduledTime, UICtoStationName(selectedTrainInfo.stations[i].stationUICCode), passed, selectedTrainInfo.stations[i].differenceInMinutes));
          i++;
          //parsedStations.push(stations[i]);
        } else {
          //First station code
          if (selectedTrainInfo.stations[i].actualTime == null) {
            passed = false;
            leaves = selectedTrainInfo.stations[i].liveEstimateTime;
          } else {
            passed = true;
            leaves = selectedTrainInfo.stations[i].actualTime;
          }
          parsedStations.push(new Station(NaN, NaN, leaves, selectedTrainInfo.stations[i].scheduledTime, UICtoStationName(selectedTrainInfo.stations[i].stationUICCode), passed));
        }
      }
    }
  }
  return parsedStations;
}*/

function updateTimetable () {
  //remove lines from table
  let stationTable = document.getElementById("stationsTable");
  for (var i = stationTable.rows.length -1; i > 0; i--) {
    stationTable.deleteRow(i);
  }

  selectedTrainStations.forEach(function (element) {
    let newRow = stationTable.insertRow(-1);

    let Saapuu = newRow.insertCell(0);
    let Asema = newRow.insertCell(1);
    let Lähtee = newRow.insertCell(2);

    let SaapuuText;
    let LähteeText;

    //Formats saapuu columm
    if (Number.isNaN(element.arrives)) {
      SaapuuText = document.createTextNode("-");
    } else {
      if (Number.isNaN(element.schedArrival)) {
        var time = new Date(element.arrives);
        SaapuuText = document.createTextNode(PrintTime(time.getHours(), time.getMinutes()));
      } else {
        var time = new Date(element.arrives);
        var timeSched = new Date(element.schedArrival);

        if (time.getHours() == timeSched.getHours() && time.getMinutes() == timeSched.getMinutes()) {
          SaapuuText = document.createTextNode(PrintTime(time.getHours(), time.getMinutes()));
        } else {
          var SchedTime = document.createElement("div");
          var SchedTimeText = document.createTextNode(PrintTime(timeSched.getHours(), timeSched.getMinutes()));
          SchedTime.appendChild(SchedTimeText);

          if (timeSched < time) {
            //Aikataulusta jäljessä
            SchedTime.classList.add("red");
          } else {
            //Etuajassa
            SchedTime.classList.add("green");
          }
          Saapuu.appendChild(SchedTime);
          SaapuuText = document.createTextNode(" ~(" + PrintTime(time.getHours(), time.getMinutes())+ ")");
        }
      }
    }

    //Formats lähtee columm
    if (Number.isNaN(element.leaves)) {
      LähteeText = document.createTextNode("-");
    } else {
      if (Number.isNaN(element.schedLeaving)) {
        var time = new Date(element.leaves);
        LähteeText = document.createTextNode(PrintTime(time.getHours(), time.getMinutes()));
      } else {
        var time = new Date(element.leaves);
        var timeSched = new Date(element.schedLeaving);

        if (time.getHours() == timeSched.getHours() && time.getMinutes() == timeSched.getMinutes()) {
          LähteeText = document.createTextNode(PrintTime(time.getHours(), time.getMinutes()));
        } else {
          var SchedTime = document.createElement("div");
          var SchedTimeText = document.createTextNode(PrintTime(timeSched.getHours(), timeSched.getMinutes()));
          SchedTime.appendChild(SchedTimeText);

          if (timeSched < time) {
            //Aikataulusta jäljessä
            SchedTime.classList.add("red");
          } else {
            //Etuajassa
            SchedTime.classList.add("green");
          }
          Lähtee.appendChild(SchedTime);
          LähteeText = document.createTextNode(" ~(" + PrintTime(time.getHours(), time.getMinutes())+ ")");
        }
      }
    }

    let AsemaText = document.createTextNode(element.stationName);

    if (element.passed == true) {
      Saapuu.classList.add("grayed");
      Asema.classList.add("grayed");
      Lähtee.classList.add("grayed");
    }

    Saapuu.appendChild(SaapuuText);
    Asema.appendChild(AsemaText);
    Lähtee.appendChild(LähteeText);
  });

  let next = findNextStation(selectedTrainStations);
  if (next != undefined) {
    document.getElementById("NextStation").innerHTML = selectedTrainStations[next].stationName;
  } else {
    document.getElementById("NextStation").innerHTML = "-";
  }
  let arrival = new Date(selectedTrainStations[selectedTrainStations.length-1].arrives);
  let sched = new Date(selectedTrainStations[selectedTrainStations.length -1].schedArrival);
  document.getElementById("ArrivalTime").innerHTML = arrival.getHours() + ":" + arrival.getMinutes();
  document.getElementById("RealArrival").innerHTML = sched.getHours() + ":" + sched.getMinutes();

  //In minutes
  let timeDifference = Math.round((arrival - sched)/1000/60);
  if (timeDifference >= 0) {
    document.getElementById("Delay").classList.remove("red");
    document.getElementById("Delay").classList.add("green");
    document.getElementById("DelayText").innerHTML = "Etuajassa: ";
  } else {
    document.getElementById("Delay").classList.add("red");
    document.getElementById("Delay").classList.remove("green");
    document.getElementById("DelayText").innerHTML = "Myöhässä: ";
  }
  document.getElementById("Delay").innerHTML = timeDifference + " min";

  resizeAllGridItems();
}

function PrintTime(Hours, Minutes) {
  var Text = Hours + ":";
  if  (Minutes < 10) {
    Text = Text + "0" + Minutes;
  } else {
    Text = Text + Minutes;
  }
  return Text;
}

function findNextStation(Stations) {
  for (var i = 1; i < Stations.length; i++) {
    if (Stations[i].passed == false && Stations[i-1].passed == true) {
      return i;
    }
  }
}

function parseComposition() {
  let sections = (JSON.parse(this.responseText)).journeySections;

  sections.forEach(function (element) {
    //console.log(element);
    let locomotives = element.locomotives;
    let wagons = element.wagons;
    let train = [];

    locomotives.forEach(function (element) {
      if (element.powerType == "Electric") {
        train.push(new Wagon(element.locomotiveType, false, false, false, false, false, false, false, false, true, element.location));
      } else {
        train.push(new Wagon(element.locomotiveType, false, false, false, false, false, false, false, true, false, element.location));
      }
    });

    wagons.forEach(function (element) {
      let pet = false;
      let video = false;
      let catering = false;
      let playground = false;
      let luggage = false;
      let smoking = false;
      let disabled = false;

      if (element.pet == true) {
        pet = true;
      }
      if (element.video == true) {
        video = true;
      }
      if (element.catering == true) {
        catering = true;
      }
      if (element.playground == true) {
        playground = true;
      }
      if (element.luggage == true) {
        luggage = true;
      }
      if (element.smoking == true) {
        smoking = true;
      }
      if (element.disabled == true) {
        disabled = true;
      }
      train.push(new Wagon(element.wagonType, playground, video, disabled, catering, pet, luggage, smoking, false, false, element.location));
    });

    selectedTrainComposition.push(new compositionJourneySection(train, element.maximumSpeed, element.totalLength, UICtoStationName(element.beginTimeTableRow.stationUICCode), UICtoStationName(element.endTimeTableRow.stationUICCode)));
  });
  //console.log(selectedTrainComposition);
  updateComposition();
}

function updateComposition() {
  let composition = document.getElementById("composition");
  composition.innerHTML = "";

  selectedTrainComposition.forEach(function (element) {
    let div = document.createElement("div");
    let TextDiv = document.createElement("div");
    let sectionText = document.createTextNode(element.from + " - " + element.to);
    TextDiv.appendChild(sectionText);
    let table = document.createElement("table");

    let otsikko = table.insertRow(-1);
    otsikko.classList.add("lihava");
    let numberOtsikko= otsikko.insertCell(-1);
    let TunnusOtsikko = otsikko.insertCell(-1);
    let palvelutOtsikko = otsikko.insertCell(-1);

    numberOtsikko.appendChild(document.createTextNode("#"));
    TunnusOtsikko.appendChild(document.createTextNode("Tunnus"));
    palvelutOtsikko.appendChild(document.createTextNode("Palvelut"));

    element.wagons.forEach(function (element) {
      let newRow = table.insertRow(-1);
      let numberCell= newRow.insertCell(-1);
      let TunnusCell = newRow.insertCell(-1);
      let PalvelutCell = newRow.insertCell(-1);

      let numberText = document.createTextNode(element.position);
      let tunnusText = document.createTextNode(element.type);

      let palvelutText = "";
      if (element.playground == true) {
        palvelutText = palvelutText + "child_friendly ";
      }
      if (element.video == true) {
        palvelutText = palvelutText + "personal_video ";
      }
      if (element.disabledPerson == true) {
        palvelutText = palvelutText + "accessible";
      }
      if (element.catering == true) {
        palvelutText = palvelutText + "restaurant";
      }
      if (element.pet == true) {
        palvelutText = palvelutText + "pets";
      }
      if (element.luggage == true) {
        palvelutText = palvelutText + "business_center";
      }
      if (element.smoking == true) {
        palvelutText = palvelutText + "smoking_rooms";
      }
      if (element.dieselLoco == true) {
        palvelutText = palvelutText + "local_gas_station";
      }
      if (element.electricLoco == true) {
        palvelutText = palvelutText + "power";
      }
      let PalvelutText = document.createTextNode(palvelutText);

      numberCell.appendChild(numberText);
      TunnusCell.appendChild(tunnusText);
      PalvelutCell.appendChild(PalvelutText);
      PalvelutCell.classList.add("material-icons");
    });

    let PituusRivi = table.insertRow(-1);
    let Pituus= PituusRivi.insertCell(-1);
    let PituusLuku = PituusRivi.insertCell(-1);
    Pituus.colSpan = "2";
    Pituus.appendChild(document.createTextNode("Pituus:"));
    PituusRivi.classList.add("lihava");
    PituusRivi.classList.add("compositionFooterLined");
    PituusRivi.setAttribute("style", "background-color: white;");
    PituusLuku.appendChild(document.createTextNode(element.length + " m"));

    let NopeusRivi = table.insertRow(-1);
    let Nopeus= NopeusRivi.insertCell(-1);
    let NopeusLuku = NopeusRivi.insertCell(-1);
    Nopeus.colSpan = "2";
    Nopeus.appendChild(document.createTextNode("Maksiminopeus:"));
    NopeusRivi.classList.add("lihava");
    NopeusRivi.setAttribute("style", "background-color: white; border-top: lightgray 1px solid;");
    NopeusLuku.appendChild(document.createTextNode(element.maxSpeed + " km/h"));

    div.appendChild(TextDiv);
    TextDiv.classList.add("TableName");
    div.appendChild(table);

    composition.appendChild(div);
    div.classList.add("compositionDiv");
  });

  resizeAllGridItems();
}

function compositionTableLine(table, position, type, palvelutText) {
  //Add line to bottom of the table
  let line = table.insertRow(-1);

  //Adds cells
  let positionCell = line.insertCell(-1);
  let typeCell = line.insertCell(-1);
  let palvelutCell = line.insertCell(-1);

  //Adds text to cells
  positionCell.appendChild(document.createTextNode(position));
  typeCell.appendChild(document.createTextNode(type));
  palvelutCell.appendChild(document.createTextNode(palvelutText));

  //Add material-icons to palvelut cell
  palvelutCell.classList.add("material-icons");
}

function isLocoInFront(locos) {
  locos.forEach(function (element) {
    if (element.position == 1) {
      return  true;
    }
  });
}

function createCompositionTable(div, composition) {
  //Remove old table or placeholder text
  let compDiv = document.getElementById(div);
  compDiv.innerHTML = "";

  //Create HTML table element
  let table = document.createElement("table");

  //Add header line to table
  let headerLine = table.insertRow(-1);
  headerLine.classList.add("lihava");
  let wagonIndexCell = headerLine.insertCell(-1);
  let wagonNameCell = headerLine.insertCell(-1);
  let palvelutCell = headerLine.insertCell(-1);

  wagonIndexCell.appendChild(document.createTextNode("#"));
  wagonNameCell.appendChild(document.createTextNode("Tunnus"));
  palvelutCell.appendChild(document.createTextNode("Palvelut"));

  //Check if locos are at front or back
  if (isLocoInFront(composition.locos) == true) {
    //First locomotives
    composition.locos.forEach(function (element) {
      compositionTableLine(table, element.position, element.type, element, palvelutToText(element.palvelut));
    });
    let locomotives = composition.locos.length;
    //Then wagons, but add locomotive count to position
    composition.wagons.forEach(function (element) {
      compositionTableLine(table, element.position + locomotives, element.type, element, palvelutToText(element.palvelut));
    });
  } else {    //Locomotives are in the back
    //First wagons
    composition.wagons.forEach(function (element) {
      compositionTableLine(table, element.position, element.type, element, palvelutToText(element.palvelut));
    });

    let wagons = composition.wagons.length;
    //Then locos, but add wagons count to position
    composition.locos.forEach(function (element) {
      compositionTableLine(table, element.position + wagons, element.type, element, palvelutToText(element.palvelut));
    });
  }
}

// Change the cursor to a pointer when the mouse is over the trains layer.
map.on('mouseenter', 'Trains', function () {
  map.getCanvas().style.cursor = 'pointer';
});

// Change it back to a pointer when it leaves.
map.on('mouseleave', 'Trains', function () {
  map.getCanvas().style.cursor = '';
});

function searchPressed() {
  let search = isNaN(document.getElementById("SearchInputBox").value);
  if (search == false) {
    window.location = './TrainView.html?train=' + document.getElementById("SearchInputBox").value;
  } else {
    window.location = './stationView.html?station=' + document.getElementById("SearchInputBox").value;
  }
}

function moreInfoPressed() {
  window.location = './TrainView.html?train=' + selectedTrain;
}
