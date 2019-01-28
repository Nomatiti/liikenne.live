function TrainLocation(number, lat, long, speed, time) {
  this.trainNumber = number;
  this.Lat = lat;
  this.Long = long;
  this.Speed = speed;
  this.Time = new Date(time);
}


function TrainInfo(operator, trainType, trainCategory, stations) {
  this.Operator = operator;
  this.Type = trainType;
  this.Category = trainCategory;
  this.Stations = stations;
}

function Station(UICCode, stopping, scheduledArrival, actualArrival, arrivalDifference, scheduledDeparture, actualDeparture, departureDifference, causes, passed) {
  this.UICCode = UICCode;
  this.Stopping = stopping;
  this.ScheduledArrival = scheduledArrival;
  this.ActualArrival = actualArrival;
  this.ArrivalDifference = arrivalDifference;
  this.ScheduledDeparture = scheduledDeparture;
  this.ActualDeparture = actualDeparture;
  this.DepartureDifference = departureDifference;
  this.Causes = causes;
  this.Passed = passed;
}

function Wagon(type, palvelut, position) {
  this.Type = type;
  this.Palvelut = palvelut;
  this.Position = position;
}

function compositionJourneySection(composition, maxSpeed, length, from, to) {
  this.Composition = composition;
  this.MaxSpeed = maxSpeed;
  this.Length = length;
  this.From = from;
  this.To = to;
}


//GeoJSON creating functions

function GeoJSONgeometry(lat, long) {
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
      JSON = JSON + ',' + GeoJSONtrain(array[i]);
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




//HttpReq function
function HttpReq(url, func) {
  let oReq = new XMLHttpRequest();
  oReq.addEventListener("load", func);
  oReq.open("GET", url);
  oReq.send();
}


//HttpReq stations
HttpReq("https://rata.digitraffic.fi/api/v1/metadata/stations", function () {
  trainStations = JSON.parse(this.responseText);
});




function parseTrainLocationMessage(message, trainsArray) {
  //Make trainLocation object
  let response;
  try {
    response = JSON.parse(message);
  }
  catch (e) {
    console.warn('Cannot parse location message' + e);
    return;
  }
  let train = new TrainLocation(response.trainNumber, response.location.coordinates[1], response.location.coordinates[0], response.speed, Date.now());

  //Search the train from array, if not in the array return undefined
  let trainPosition = searchTrainFromArray(train.trainNumber, trainsArray);

  //If train is already in the array update it, if not push the new train
  if (trainPosition == undefined) {
    //Train is new and not in the array -> Push the new train to the array
    trainsArray.push(train);
  } else {
    //Train is already in the array -> update the old object
    trainsArray[trainPosition] = train;
  }

  //Remove any old trains from the array
  removeOldTrains(trainsArray);

  //If train is currently selected update speed
  if (train.trainNumber == selectedTrain) {
    document.getElementById('speed').innerHTML = train.Speed;
  }

  //too slow when it updates every time
  //Update map so new train position is shown
  //map.getSource('Trains').setData(JSON.parse(GeoJSONtrainsCollection(trainsArray)));
}


function parseTrainMessage(message, firstTime) {
  //If message is from HttpReq it is in array, mqtt is not
  let response;
  if (firstTime == true) {
    response = JSON.parse(message)[0];
  } else {
    response = JSON.parse(message);
  }

  createTimetable('stationsTable', parseStations(response.timeTableRows), false, false);
  resizeAllGridItems();


  if (firstTime == true) {
    //Train is clicked and this function runs first time: Load composition, write text that doesn't change (mistä
    // mihin, train number)

    HttpReq('https://rata.digitraffic.fi/api/v1/compositions/')

  }
}




//Function to search trainNumber from array and return index if it is found
function searchTrainFromArray(trainNumber, array) {
  //Go trough the array until same trainNumber is found
  for (i = 0; i < array.length; i++) {
    //Check if number matches the one specified
    if (array[i].trainNumber == trainNumber) {
      //Return the index of train in the array
      return i;
    }
  }
}


//Function to remove one minute old trains
function removeOldTrains(array) {
  let timeNow = Date.now();

  //One minute back in time
  timeNow -= 60000;

  //Make timeNow time object again
  timeNow = new Date(timeNow);

  array.forEach(function (train, index) {
    //Check if train is older than minute
    if (train.Time < timeNow) {
      //Remove/splice old train from the array
      array.splice(index, 1);
    }
  });
}




//Response parsing code

//Function that return true if one of the locomotices has position 1 (Meaning it is in front)
function isLocoInFront(locos) {
  locos.forEach(function (element) {
    if (element.position == 1) {
      return  true;
    }
  });
}


//Function to parse composition response and return an array with parsed compositionJourneySections
function parseComposition(response) {
  //Array which is returned
  let output = [];

  let sections;

  //Sections from the input
  try {
    sections = JSON.parse(response).journeySections;

    //Go trough every journey section
    sections.forEach(function(section) {
      //Array for current section composition
      let sectionComposition = [];

      //Locomotives and wagons from current section
      let locomotives = section.locomotives;
      let wagons = section.wagons;

      let locomotivePosition = 0;
      let wagonPosition = 0;

      //Is locomotive in front or no
      if (isLocoInFront(locomotives) == true) {
        //In front
        wagonPosition = locomotives.length;
      } else {
        //At back, wagons at front
        locomotivePosition = wagons.length;
      }

      locomotives.forEach(function (loco) {
        if (loco.powerType == 'Electric') {
          sectionComposition.push(new Wagon(loco.locomotiveType, ["electric"], loco.location + locomotivePosition));
        } else {
          sectionComposition.push(new Wagon(loco.locomotiveType, ["diesel"], loco.location + locomotivePosition));
        }
      });

      wagons.forEach(function (wagon) {
        let palvelut = [];

        if (wagon.pet == true) {
          palvelut.push("pet");
        }
        if (wagon.video == true) {
          palvelut.push("video");
        }
        if (wagon.catering == true) {
          palvelut.push("catering");
        }
        if (wagon.playground == true) {
          palvelut.push("playground");
        }
        if (wagon.luggage == true) {
          palvelut.push("luggage");
        }
        if (wagon.smoking == true) {
          palvelut.push("smoking");
        }
        if (wagon.disabled == true) {
          palvelut.push("disabled");
        }

        if (wagon.wagonType == undefined) {
          sectionComposition.push(new Wagon('-', palvelut, wagon.location + wagonPosition));
        } else {
          sectionComposition.push(new Wagon(wagon.wagonType, palvelut, wagon.location + wagonPosition));
        }
      });

      //Sort the array by position
      sectionComposition = sectionComposition.sort(function (a, b) {  return a.Position - b.Position;  });

      //Push journey section to output
      output.push(new compositionJourneySection(sectionComposition, section.maximumSpeed, section.totalLength, section.beginTimeTableRow.stationUICCode, section.endTimeTableRow.stationUICCode));
    });
  }
  catch (e) {
    console.warn('Train has no composition data or some other error happened');
    output = [];
  }

  //return parsed composition
  return output;
}


//Function to take TimeTableRows array and return an array with parsed Stations
function parseStations(TimeTableRows) {
  let output = [];

  //Loop every item in timetable (it will skip every station departure when it notices it has arrival and leaving data)
  for (var i = 0; i < TimeTableRows.length; i++) {
    let Row = TimeTableRows[i];

    //Check if it is the last station which has only an arrival, because it would get [i + 1] => undefined error
    if (i >= TimeTableRows.length - 1) {

      //Code for handling the last station
      //Check if train has already arrived to the last station
      if (Row.actualTime == null) {
        //Train hasn't arrived
        output.push(new Station(Row.stationUICCode, Row.trainStopping, Row.scheduledTime, Row.liveEstimateTime, Row.differenceInMinutes, undefined, undefined, undefined, Row.causes, false));
      } else {
        //Train has arrived
        output.push(new Station(Row.stationUICCode, Row.trainStopping, Row.scheduledTime, Row.actualTime, Row.differenceInMinutes, undefined, undefined, undefined, Row.causes, true));
      }

    } else {
      //Code for everyother than the last station
      let Next = TimeTableRows[i+1];

      //Check if it next station has the same name which means that they are arrival and departure data. This is
      // true everytime other that in the first station which has only a departure
      if (Row.stationUICCode == Next.stationUICCode) {
        //Station is separated in two parts; arrival and departure, which are in two indexes. These stations are
        // everyone other than the starting and stopping station
        let realArrival;
        let realDeparture;
        let passed;

        //Is train arrived already
        if (Row.actualTime == null) {
          //It hasn't arrived
          realArrival = Row.liveEstimateTime;
        } else {
          //It has arrived to station
          realArrival = Row.actualTime;
        }

        //Is train departed
        if (Next.actualTime == null) {
          //Train hasn't departed
          realDeparture = Next.liveEstimateTime;
          passed = false;
        } else {
          //Train has departed
          realDeparture = Next.actualTime;
          passed = true;
        }
        //Push station to output
        output.push(new Station(Row.stationUICCode, Row.trainStopping, Row.scheduledTime, realArrival, Row.differenceInMinutes, Next.scheduledTime, realDeparture, Next.differenceInMinutes, (Row.causes).concat(Next.causes), passed));

        i++;
      } else {
        //First station, which has only a departure
        //First check if train has already departed
        if (Row.actualTime == null) {
          //Train hasn't departed from the first station
          output.push(new Station(Row.stationUICCode, Row.trainStopping, undefined, undefined, undefined, Row.scheduledTime, Row.liveEstimateTime, Row.differenceInMinutes, Row.causes, false));
        } else {
          //Train has departed from the starting station
          output.push(new Station(Row.stationUICCode, Row.trainStopping, undefined, undefined, undefined, Row.scheduledTime, Row.actualTime, Row.differenceInMinutes, Row.causes, true));
        }
      }
    }
  }

  //return the output which has all the stations in array
  return output;
}




//Composition code

//Function that creates one line of composition table
function compositionTableLine(wagon, table) {
  //make new row
  let row = table.insertRow(-1);

  //make string with all the palvelut
  let PalvelutText = '';
  wagon.Palvelut.forEach(function (item) {
    let text = '';
    if (item == 'electric') {
      text = 'flash_on';
    }
    if (item == 'diesel') {
      text = 'local_gas_station';
    }
    if (item == 'pet') {
      text = 'pets';
    }
    if (item == 'video') {
      text = 'personal_video';
    }
    if (item == 'catering') {
      text = 'restaurant';
    }
    if (item == 'playground') {
      text = 'child_friendly';
    }
    if (item == 'luggage') {
      text = 'work';
    }
    if (item == 'smoking') {
      text = 'smoking_rooms';
    }
    if (item == 'disabled') {
      text = 'accessible';
    }
    PalvelutText = PalvelutText + text + ' ';
  });

  //Add first cell with wagon position
  row.insertCell(-1).appendChild(document.createTextNode(wagon.Position));
  //Cell with wagon name/type
  row.insertCell(-1).appendChild(document.createTextNode(wagon.Type));
  //Cell with palvelut
  let PalvelutCell = row.insertCell(-1);
  PalvelutCell.appendChild(document.createTextNode(PalvelutText));
  PalvelutCell.classList.add('material-icons');
}


//Function that creates one composition table and appends it to divToAdd div
function createOneCompositionTable(section, divToAdd) {
  //Create div for the new table
  let div = document.createElement('div');

  //Create header with first and last station
  let headerDiv = document.createElement('div');
  headerDiv.classList.add('tableName');
  headerDiv.appendChild(document.createTextNode(UICCodeToStationName(section.From, trainStations) + ' - ' + UICCodeToStationName(section.To, trainStations)));
  //Add it to div
  div.appendChild(headerDiv);

  //Create the table
  let table = document.createElement('table');

  //Make first line to it with:  | # | Tunnus | Palvelut |
  let firstLine = table.insertRow(-1);
  firstLine.classList.add('lihava');
  firstLine.insertCell(-1).appendChild(document.createTextNode('#'));
  firstLine.insertCell(-1).appendChild(document.createTextNode('Tunnus'));
  firstLine.insertCell(-1).appendChild(document.createTextNode('Palvelut'));

  //go trough composition. Composition is array with Wagons
  section.Composition.forEach(function (wagon) {
    compositionTableLine(wagon, table);
  });

  //Add pituus and nopeus lines
  let pituusLine = table.insertRow(-1);
  pituusLine.classList.add('CompositionFooterLined');
  let pituusTextCell = pituusLine.insertCell(-1);
  let pituusNumberCell = pituusLine.insertCell(-1);
  pituusTextCell.colSpan = '2';
  pituusTextCell.classList.add('lihava');
  pituusTextCell.appendChild(document.createTextNode('Pituus: '));
  pituusNumberCell.appendChild(document.createTextNode(section.Length + ' m'));

  let nopeusLine = table.insertRow(-1);
  nopeusLine.setAttribute('style', 'background-color: white; border-top: lightgray 1px solid;');
  let nopeusTextCell = nopeusLine.insertCell(-1);
  let nopeusNumberCell = nopeusLine.insertCell(-1);
  nopeusTextCell.colSpan = '2';
  nopeusTextCell.classList.add('lihava');
  nopeusTextCell.appendChild(document.createTextNode('Maksiminopeus: '));
  nopeusNumberCell.appendChild(document.createTextNode(section.MaxSpeed + ' km/h'))

  //Add table to div
  div.appendChild(table);

  //Add complete div to divToAdd
  divToAdd.appendChild(div);
}


//Function that creates and appends composition tables to var div
function createCompositionTables(div, composition) {
  let time = Date.now();
  let compositionDiv = document.getElementById(div);

  //Empty the div
  compositionDiv.innerHTML = '';

  //Call function that adds each section ass new table and appends it to compositionDiv
  composition.forEach(function (item) {
    createOneCompositionTable(item, compositionDiv);
  });

  //Empty the div
  compositionDiv.innerHTML = '';

  //Call function that adds each section ass new table and appends it to compositionDiv
  composition.forEach(function (item) {
    createOneCompositionTable(item, compositionDiv);
  });

  let timeDiff = Date.now() - time;
  console.log('Composition time: ' + new Date(timeDiff).getMilliseconds() + ' ms');
}




//Timetable code

//Function that takes time and prints it as text with added zeros if under 10
function prettyTime(timeIn) {
  //Get hours and minutes from time
  let time = new Date(timeIn);
  let Hours = time.getHours();
  let Minutes = time.getMinutes();

  if (isNaN(Hours) == true) {
    return '--:--';
  }

  let output;

  //Add hours
  if (Hours < 10) {
    //Add zero in front
    output = '0' + Hours + ':';
  } else {
    output = Hours + ':';
  }

  //Add minutes
  if (Minutes < 10) {
    //Add zero in front
    output = output + '0' + Minutes;
  } else {
    output = output + Minutes;
  }

  //Return result
  return output;
}


//Function that takes UICCode and return station name
function UICCodeToStationName(UICCode, stationsTable) {
  function findStation(element) {
    return element.stationUICCode == UICCode;
  }

  let index = stationsTable.findIndex(findStation);
  //Return name without "asema"
  return stationsTable[index].stationName.replace('asema', '');
}


//Function that takes station and creates line and appends that to table
function timetableRow(table, station) {
  //Create new row
  let row = table.insertRow(-1);

  let ArrivalScheduleText;
  let ArrivalRealText;

  let DepartureScheduleText;
  let DepartureRealText;

  //Arrival cell
  let arrivalCell = row.insertCell(-1);
  let ActualSpan = document.createElement('span');

  if (station.ScheduledArrival == undefined) {
    //Train hasn't have arrival data (It is the first station
    ArrivalScheduleText = document.createTextNode('-');
    ArrivalRealText = document.createTextNode('');
  } else {
    //Train has arrival data

    //Does station have real arrival data
    if (station.ActualArrival != undefined) {
      //It has real arrival time
      //Show real time only if it is different than the scheduled time
      if (station.ArrivalDifference != 0) {
        //Scheduled time and real time are different
        ArrivalRealText = document.createTextNode(prettyTime(station.ActualArrival));
        ArrivalScheduleText = document.createTextNode(' (' + prettyTime(station.ScheduledArrival) + ')');
      } else {
        //Real and sheduled time are the same so only show sheduled
        ArrivalRealText = document.createTextNode('');
        ArrivalScheduleText = document.createTextNode(prettyTime(station.ScheduledArrival));
      }

    } else {
      //Has only scheduled time
      ArrivalRealText = document.createTextNode('');
      ArrivalScheduleText = document.createTextNode(prettyTime(station.ScheduledArrival));
    }


    //Make real time red or green based on is the train late or early
    if (station.ArrivalDifference > 0) {
      //Late = red
      ActualSpan.classList.add('red');
    }
    if (station.ArrivalDifference < 0) {
      //Early = green
      ActualSpan.classList.add('green');
    }
  }

  //Add real arrival to span and add both texts to cell
  ActualSpan.appendChild(ArrivalRealText);
  arrivalCell.appendChild(ActualSpan);
  arrivalCell.appendChild(ArrivalScheduleText);


  //Station cell
  row.insertCell(-1).appendChild(document.createTextNode(UICCodeToStationName(station.UICCode, trainStations)));


  //Departure cell
  let departureCell = row.insertCell(-1);
  let departureSpan = document.createElement('span');

  if (station.ScheduledDeparture == undefined) {
    //Train hasn't have departure data (last station)
    DepartureScheduleText = document.createTextNode('-');
    DepartureRealText = document.createTextNode('');
  } else {
    //Train has departure data



    //Does station have real departure data
    if (station.ActualDeparture != undefined) {
      //It has real departure time
      //Show real time only if it is different than the scheduled time
      if (station.DepartureDifference != 0) {
        //Scheduled time and real time are different
        DepartureRealText = document.createTextNode(prettyTime(station.ActualDeparture));
        DepartureScheduleText = document.createTextNode(' (' + prettyTime(station.ScheduledDeparture) + ')');
      } else {
        //Real and sheduled time are the same so only show sheduled
        DepartureRealText = document.createTextNode('');
        DepartureScheduleText = document.createTextNode(prettyTime(station.ScheduledDeparture));
      }

    } else {
      //Has only scheduled time
      DepartureRealText = document.createTextNode('');
      DepartureScheduleText = document.createTextNode(prettyTime(station.ScheduledDeparture));
    }

    //Make real time red or green based on is the train late or early
    if (station.DepartureDifference > 0) {
      //Late = red
      departureSpan.classList.add('red');
    }
    if (station.DepartureDifference < 0) {
      //Early = green
      departureSpan.classList.add('green');
    }
  }

  //Add real deparure to span and add both texts to cell
  departureSpan.appendChild(DepartureRealText);
  departureCell.appendChild(departureSpan);
  departureCell.appendChild(DepartureScheduleText);


  //Make line gray if train has passed the station
  if (station.Passed == true) {
    row.classList.add('grayed');
  }
}


//Function that creates and appends timetable to div
function createTimetable(tableName, timetableArray, showAll, showReason) {
  let time = Date.now();
  let table = document.getElementById(tableName);

  //Remove old lines from table
  for (var i = table.rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }

  //Go trough every station that the train passes
  timetableArray.forEach(function (station) {
    if (showAll == false && station.Stopping == false) {
      //Don't do anything
    } else {
      //Create new line
      timetableRow(table, station);
    }
  });

  let next = findNextStation(timetableArray);

  if (next != undefined) {
    document.getElementById('NextStation').innerHTML = UICCodeToStationName(next, trainStations);
  } else {
    document.getElementById('NextStation').innerHTML = '-';
  }

  document.getElementById('ArrivalTime').innerHTML = prettyTime(timetableArray[timetableArray.length - 1].ScheduledArrival);
  document.getElementById('RealArrival').innerHTML = prettyTime(timetableArray[timetableArray.length - 1].ActualArrival);

  let lastStation = timetableArray[timetableArray.length - 1];
  
  if (lastStation.ArrivalDifference != 0) {
    if (lastStation.ArrivalDifference > 0) {
      //Myöhässä
      document.getElementById('Delay').innerHTML = lastStation.ArrivalDifference;
      document.getElementById('Delay').classList.add('red');
      document.getElementById('Delay').classList.remove('green');
      document.getElementById('DelayText').innerHTML = 'Myöhässä: ';
    } else {
      //Etuajassa
      document.getElementById('Delay').innerHTML = -(lastStation.ArrivalDifference);
      document.getElementById('Delay').classList.add('green');
      document.getElementById('Delay').classList.remove('red');
      document.getElementById('DelayText').innerHTML = 'Etuajassa: ';
    }
  } else {
    //Ajoissa
    document.getElementById('Delay').innerHTML = '0';
    document.getElementById('Delay').classList.remove('red');
    document.getElementById('Delay').classList.remove('green');
    document.getElementById('DelayText').innerHTML = 'Etuajassa: ';
  }

  if (oneTrain == true) {
    let table = document.createElement('table');
    let otsikko = table.insertRow(-1);
    otsikko.insertCell(-1).appendChild(document.createTextNode('Asema'));
    otsikko.insertCell(-1).appendChild(document.createTextNode('Syy'));
    otsikko.classList.add('lihava');

    timetableArray.forEach(function (station) {
      if (station.Causes.length > 0) {

        let line = table.insertRow(-1);
        let stationCell = line.insertCell(-1);
        stationCell.appendChild(document.createTextNode(UICCodeToStationName(station.UICCode, trainStations)));
        stationCell.classList.add('lihava');

        let syyCell = line.insertCell(-1);

        let thirdCategoryCode = station.Causes[0].thirdCategoryCodeId;
        let detailedCategoryCodeId = station.Causes[0].detailedCategoryCodeId;
        let Luokka = station.Causes[0].categoryCodeId;

        if (thirdCategoryCode != undefined) {
          //Check if KolmannenTasonSyykoodi on avoimessa datassa
          var index = KolmannenTasonSyykoodit.find(function (Syykoodi) {
            return Syykoodi.id == thirdCategoryCode;
          });

          if (index != undefined) {
            syyCell.appendChild(document.createTextNode(index.thirdCategoryName));
          } else {
            var index = Syykoodit.find(function (Syykoodi) {
              return Syykoodi.id == detailedCategoryCodeId;
            });
            if (index != undefined) {
              syyCell.appendChild(document.createTextNode(index.detailedCategoryName));
            } else {
              var index = Syyluokat.find(function (Syyluokka) {
                return Syyluokka.id == Luokka;
              });
              syyCell.appendChild(document.createTextNode(index.categoryName));
            }
          }
        } else {
          var index = Syykoodit.find(function (Syykoodi) {
            return Syykoodi.id == detailedCategoryCodeId;
          });
          if (index != undefined) {
            syyCell.appendChild(document.createTextNode(index.detailedCategoryName));
          } else {
            var index = Syyluokat.find(function (Syyluokka) {
              return Syyluokka.id == Luokka;
            });
            syyCell.appendChild(document.createTextNode(index.categoryName));
          }
        }
        document.getElementById('syyt').innerHTML = '';
        document.getElementById('syyt').appendChild(table);
      }
    });
  }


  let timeDiff = Date.now() - time;
  console.log('Timetable time: ' + new Date(timeDiff).getMilliseconds() + ' ms');
}




//Info box code
function updateInfoBox(trainData) {
  let input = JSON.parse(trainData);

  document.getElementById('trainNumber').innerHTML = input[0].trainType + ' ' + input[0].trainNumber;
  // document.getElementById('mistämihin').innerHTML = input.;
  document.getElementById('operator').innerHTML = input[0].operatorShortCode;

  let category;

  switch (input[0].trainCategory) {
    case 'Long-distance':
      category = 'Kaukoliikenne';
      break;
    case 'Commuter':
      category = 'lähiliikenne';
      break;
    case 'Cargo':
      category = 'Tavaraliikenne';
      break;
    case 'Locomotive':
      category = 'Veturi';
      break;
    default:
      category = input[0].trainCategory;
      break;
  }

  document.getElementById('category').innerHTML = category;
  document.getElementById('mistämihin').innerHTML = UICCodeToStationName(input[0].timeTableRows[0].stationUICCode, trainStations) + ' - ' + UICCodeToStationName(input[0].timeTableRows[input[0].timeTableRows.length - 1].stationUICCode, trainStations);
}



function changeMap(style) {
  switch (style) {
    case 'railwayMap':
      map.setStyle('mapbox://styles/nomatiti/cjh3f0hvg0v572spc6pnol7yj');
      break;
    case 'streets':
      map.setStyle('mapbox://styles/mapbox/streets-v9');
      break;
    case 'bright':
      map.setStyle('mapbox://styles/mapbox/bright-v9');
      break;
    case 'satellite':
      map.setStyle('mapbox://styles/mapbox/satellite-streets-v9');
      break;
    case 'Light':
      map.setStyle('mapbox://styles/mapbox/light-v9');
      break;
    case 'Dark':
      map.setStyle('mapbox://styles/mapbox/dark-v9');
      break;
    default:
      break;
  }
}


function searchPressed() {
  let search = isNaN(document.getElementById("searchInputBox").value);
  if (search == false) {
    window.location = './juna.html?train=' + document.getElementById("searchInputBox").value;
  } else {
    window.location = './asema.html?station=' + document.getElementById("searchInputBox").value;
  }
}

function findNextStation(stationsArray) {
  for (var i = 1; i < stationsArray.length; i++) {
    if (stationsArray[i].Passed == false && stationsArray[i-1].Passed == true) {
      return stationsArray[i].UICCode;
    }
  }
}