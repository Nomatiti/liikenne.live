function TrainLocation(number, lat, long, speed, time) {
    this.trainNumber = number;
    this.Lat = lat;
    this.Long = long;
    this.Speed = speed;
    this.Time = new Date(time);
}

function Vessel(mmsi, lat, long, heading, rot, cog, sog, time, name, draught, callsign, eta, destination, type) {
    this.Mmsi = mmsi;
    this.Lat = lat;
    this.Long = long;
    this.Heading = heading;
    this.Rot = rot;
    this.Cog = cog;
    this.Sog = sog;
    this.Time = new Date(time);
    this.Name = name;
    this.Draught = draught;
    this.Callsign = callsign;
    this.Eta = eta;
    this.Destination = destination;
    this.Type = type;
    this.arrival = function() {
        let base2 = (this.Eta).toString(2);
        let minutes = clamp(parseInt(base2.slice(-6), 2), 0, 60);
        let hours = clamp(parseInt(base2.slice(-11, -6), 2), 0, 24);
        let day = clamp(parseInt(base2.slice(-16, -11), 2), 0, 31);
        let month = clamp(parseInt(base2.slice(0, 4), 2) - 5, 0, 12);
        let timezoneCorrection = new Date().getTimezoneOffset() / -60;
        hours = hours + timezoneCorrection;

        if (hours > 24) {
            hours = hours - 24;
            day = day + 1;
        }

        return new Date(new Date(Date.now()).getFullYear(), month, day, hours, minutes);
    };
}

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function HSL(type, desi, dir, oper, veh, tsi, spd, hdg, lat, long, acc, dl, odo, drst, start, dest) {
    this.Type = type;
    this.Desi = desi;
    this.Dir = dir;
    this.Oper = oper;
    this.Veh = oper;
    this.Time = new Date(tsi);
    this.Spd = spd;
    this.Hdg = hdg;
    this.Lat = lat;
    this.Long = long;
    this.Acc = acc;
    this.Dl = dl;
    this.Odo = odo;
    this.Drst = drst;
    this.Start = start;
    this.Dest = dest;
    this.HSLidentifier = oper + "/" + veh;
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



/*function GeoJSONvessel(object) {
    let feature = '{"type":"Feature","properties":{"Mmsi":' + object.Mmsi + ',"Cog":' + object.Cog + ',"Destination":"' + object.Destination + '","Draught":' + object.Draught + ',"Eta":' + object.Eta + ',"Heading":' + object.Heading + ',"Name":"' + object.Name + '","Rot":' + object.Rot + ',"Callsign":"' + object.Callsign + '","Sog":' + object.Sog + '},"geometry":' + GeoJSONgeometry(object.Lat, object.Long) + '}';
    return feature;
}*/

function GeoJSONvessel(object) {
    let feature = {
        type: "Feature",
        properties: {
            Mmsi: object.Mmsi,
            Cog: object.Cog,
            Destination: object.Destination,
            Draught: object.Draught,
            Eta: object.Eta,
            Heading: object.Heading,
            Name: object.Name,
            Rot: object.Rot,
            Callsign: object.Callsign,
            Sog: object.Sog,
            Type: object.Type
        },
        geometry: {
            type: "Point",
            coordinates: [object.Long, object.Lat]
        }
    };
    return feature;
}

/*function GeoJSONvesselCollection(array) {
    let JSON = '{"type":"FeatureCollection","features":[';
    if (array.length != 0) {
        JSON = JSON + GeoJSONvessel(array[0]);
        for (var i = 1; i < array.length; i++) {
            JSON = JSON + ',' + GeoJSONvessel(array[i]);
        }
    }
    JSON = JSON + ']}';
    //console.log(JSON);
    return JSON;
}*/

function GeoJSONvesselCollection(array) {
    let features = [];

    array.forEach(function (element) {
        let filter = filterObject(vesselFilter, element, invertFilter);
        if (filter === true) {
            features.push(GeoJSONvessel(element));
        }
    });

    let collection = {
        type: "FeatureCollection",
        features: features
    };

    return JSON.stringify(collection);
}

//[{key: ###, value: ###}, {key: ###, value: [##, ##, ##]}, {key: ###, value: ###}]
//returns false or true based on if the element passd the test
function filterObject(filterArray, element, invert) {
    let passed = true;

    for (let i = 0; i < filterArray.length; i++) {
        if (passed === false) {
            break;
        }
        if (Array.isArray(filterArray[i].value) === true) {
            for (let x = 0; x < filterArray[i].value.length; x++) {
                if (filterArray[i].value[x] == element[filterArray[i].key]) {
                    break;
                } else if (x === filterArray[i].value.length - 1) {
                    passed = false;
                    break;
                }
            }
        } else {

            if (typeof filterArray[i].value === "string") {
                let filterStringLength = filterArray[i].value.length;
                let valueLength = element[filterArray[i].key].length;

                if  (valueLength >= filterStringLength) {
                    for (let wordPosition = 0; wordPosition <= (valueLength - filterStringLength); wordPosition++) {
                        let found = element[filterArray[i].key].toLowerCase().startsWith(filterArray[i].value.toLowerCase(), wordPosition);

                        if (found === true) {
                            break;
                        }
                        if (found === false && wordPosition === valueLength - filterStringLength) {
                            passed = false;
                            break;
                        }
                    }
                } else {
                    passed = false;
                    break;
                }
            } else {
                if (filterArray[i].value != element[filterArray[i].key]) {
                    passed = false;
                    break;
                }
            }
        }
    }
    if (invert === true) {
        if (passed === true) {
            passed = false;
        } else {
            passed = true
        }
    }
    return passed;
}

function searchVesselMetadata(array, mmsi) {
    for (let i = 0, len = array.length; i < len; i++) {
        if (array[i].mmsi === mmsi) {
            return i;
        }
    }
    return -1;
}

function parseVesselLocationMessage(message, vesselsArray) {
    //Make vessel object
    let response;
    try {
        response = JSON.parse(message);
    }
    catch (e) {
        console.warn('Cannot parse location message' + e);
        return;
    }
    let vessel = new Vessel(response.mmsi, response.geometry.coordinates[1], response.geometry.coordinates[0], response.properties.heading, response.properties.rot, response.properties.cog, response.properties. sog, response.properties.timestampExternal, "-", 0, "-", 0, "-", 0);

    //Search the vessel from array, if not in the array return undefined
    let vesselPosition = searchVesselFromArray(vessel.Mmsi, vesselsArray);

    //If vessel is already in the array update it, if not push the new vessel
    if (vesselPosition == undefined) {
        let detailsIndex = searchVesselMetadata(vesselDetails, vessel.Mmsi);
        let index = searchVesselMetadata(allMetadata, vessel.Mmsi);

        if (index !== -1) {
            vessel.Name = allMetadata[index].name;
            vessel.Draught = allMetadata[index].draught;
            vessel.Callsign = allMetadata[index].callSign;
            vessel.Eta = allMetadata[index].eta;
            vessel.Destination = allMetadata[index].destination;
            vessel.Type = allMetadata[index].shipType;
        }
        if (detailsIndex !== -1) {
            vessel.Name = vesselDetails[detailsIndex].name;
            vessel.Draught = vesselDetails[detailsIndex].vesselDimensions.draught;
            vessel.Type = vesselDetails[detailsIndex].vesselConstruction.vesselTypeCode;
        }

        //Vessel is new and not in the array -> Push the new vessel to the array
        vesselsArray.push(vessel);
    } else {
        //Vessel is already in the array -> update the old object
        vesselsArray[vesselPosition].Lat =  vessel.Lat;
        vesselsArray[vesselPosition].Long =  vessel.Long;
        vesselsArray[vesselPosition].Heading =  vessel.Heading;
        vesselsArray[vesselPosition].Rot = vessel.Rot;
        vesselsArray[vesselPosition].Cog = vessel.Cog;
        vesselsArray[vesselPosition].Sog = vessel.Sog;
        vesselsArray[vesselPosition].Time = vessel.Time;

        if (vesselsArray[vesselPosition].Type === 0) {
            let detailsIndex = searchVesselMetadata(vesselDetails, vessel.Mmsi);
            if (detailsIndex !== -1) {

                vessel.Name = vesselDetails[detailsIndex].name;
                vessel.Draught = vesselDetails[detailsIndex].vesselDimensions.draught;
                vessel.Type = vesselDetails[detailsIndex].vesselConstruction.vesselTypeCode;
            }
        }
    }
}

//Function to search vessel mmsi from array and return index if it is found
function searchVesselFromArray(mmsi, array) {
    //Go trough the array until same mmsi is found
    for (i = 0; i < array.length; i++) {
        //Check if number matches the one specified
        if (array[i].Mmsi === mmsi) {
            //Return the index of vessel in the array
            return i;
        }
    }
}

function parseVesselMetadataMessage(message, vesselsArray) {
    let response;
    try {
        response = JSON.parse(message);
    }
    catch (e) {
        console.warn('Cannot parse metadata message' + e);
        return;
    }

    //Search the vessel from array, if not in the array return undefined
    let vesselPosition = searchVesselFromArray(response.mmsi, vesselsArray);

    if (vesselPosition !== undefined) {
        let vessel = vesselsArray[vesselPosition];

        vessel.Name = response.name;
        vessel.Draught = response.draught;
        vessel.Callsign = response.callSign;
        vessel.Eta = response.eta;
        vessel.Destination = response.destination;

        if (vessel.Mmsi === selectedVessel) {
            updateVesselInfo(vessel);
        }
    }
}

function scale(num, in_min, in_max, out_min, out_max) {
    return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
}

function updateVesselInfo(object) {
    $("#name").text(prettyPrintItem(object.Name));
    $("#määränpää").text(prettyPrintItem(object.Destination));
    $("#callsign").text(prettyPrintItem(object.Callsign));
    $("#mmsi").text(prettyPrintItem(object.Mmsi));
    $("#category").text(prettyPrintItem(typecodeToString(object.Type)));
    $("#speed").text(prettyPrintItem(object.Sog));
    $("#turningSpeed").text(prettyPrintItem(object.Rot));
    $("#draught").text(prettyPrintItem(object.Draught));
    $("#Eta").text(prettyPrintItem(object.arrival().toLocaleString()));
}

function updateVesselDetails(object) {
    if (object.clear === undefined) {
        $("#ballast").text(prettyPrintItem(object.vesselConstruction.ballastTank));
        $("#doubleBottom").text(prettyPrintItem(object.vesselConstruction.doubleBottom));
        $("#gasSystem").text(prettyPrintItem(object.vesselConstruction.inertGasSystem));
        $("#iceClass").text(prettyPrintItem(object.vesselConstruction.iceClassCode));
        $("#issueDate").text(new Date(object.vesselConstruction.iceClassIssueDate).toLocaleDateString());
        $("#iceEndDate").text(new Date(object.vesselConstruction.iceClassEndDate).toLocaleDateString());
        $("#iceIssuer").text(prettyPrintItem(object.vesselConstruction.iceClassIssuePlace));
        $("#ballast").text(prettyPrintItem(object.vesselConstruction.ballastTank));
        $("#gross").text(prettyPrintItem(object.vesselDimensions.grossTonnage));
        $("#motorPower").text(prettyPrintItem(object.vesselDimensions.enginePower));
        $("#maxSpeed").text(prettyPrintItem(object.vesselDimensions.maxSpeed));
        $("#height").text(prettyPrintItem(object.vesselDimensions.height));
        $("#length").text(prettyPrintItem(object.vesselDimensions.length));
        $("#overallLength").text(prettyPrintItem(object.vesselDimensions.overallLength));
        $("#nationality").text(prettyPrintItem(object.vesselRegistration.nationality));
        $("#port").text(prettyPrintItem(object.vesselRegistration.portOfRegistry));
        $("#owner").text(prettyPrintItem(object.vesselSystem.shipOwner));
        $("#phone").text(prettyPrintItem(object.vesselSystem.shipTelephone1));
        $("#email").text(prettyPrintItem(object.vesselSystem.shipEmail));
    } else {
        $("#ballast").text("");
        $("#doubleBottom").text("");
        $("#gasSystem").text("");
        $("#iceClass").text("");
        $("#issueDate").text("");
        $("#iceEndDate").text("");
        $("#iceIssuer").text("");
        $("#ballast").text("");
        $("#gross").text("");
        $("#motorPower").text("");
        $("#maxSpeed").text("");
        $("#height").text("");
        $("#length").text("");
        $("#overallLength").text("");
        $("#nationality").text("");
        $("#port").text("");
        $("#owner").text("");
        $("#phone").text("");
        $("#email").text("");
    }
    resizeAllGridItems();
}

function prettyPrintItem(item) {
    if (item === undefined || item === null || item === "" || item === " ") {
        return "-";
    } else if (item === true) {
        return "on";
    } else if (item === false) {
        return "ei ole";
    } else {
        return item;
    }
}

function prettyDate(time) {
    let x = new Date(time);
    return x.getDay() + "." + x.getMonth() + "." + x.getFullYear();
}

function typecodeToString(code) {
    for (i = 0; i < vesselTypes.length; i++) {
        if (vesselTypes[i].code == code) {
            return vesselTypes[i].description;
        }
    }
    return "";
}


function updateHSLarray(message, topic, HSLarray) {
    //"/hfp/v1/journey/ongoing/bus/0022/00807/4624/2/Tikkurila/13:37/4610206/4/60;25/20/94/23"
    let type = "";
    if (topic.slice(24, 28) == "bus/") {
        type = "Bussi";
    } else if (topic.slice(24, 28) == "tram") {
        type = "Raitiovaunu";
    } else if (topic.slice(24, 29) == "train") {
        type = "Lähijuna";
    }
    let object = new HSL(type, message.desi, message.dir, message.oper, message.veh, message.tst, message.spd, message.hdg, message.lat, message.long, message.acc, message.dl, message.odo, message.drst, message.start, topic.split("/")[10]);

    //Search the train from array, if not in the array return undefined
    let position = searchHSLFromArray(object.HSLidentifier, HSLarray);

    //If train is already in the array update it, if not push the new train
    if (position == undefined) {
        //Train is new and not in the array -> Push the new train to the array
        HSLarray.push(object);
    } else {
        //Train is already in the array -> update the old object
        HSLarray[position] = object;
    }

    //If train is currently selected update speed
    if (object.HSLidentifier == selectedHSL) {
        console.log(object);
        updateSidePanelHSL(object);
    }
}

//Function to search "operator/number" from array and return index if it is found
function searchHSLFromArray(identifier, array) {
    //Go trough the array until it is found
    for (i = 0; i < array.length; i++) {
        //Check if number matches the one specified
        if (array[i].HSLidentifier == identifier) {
            //Return the index of HSL in the array
            return i;
        }
    }
}

function GeoJSON_HSL(object) {
    let feature = '{"type":"Feature","properties":{"Type":"' + object.Type + '","Desi":"' + object.Desi + '","Dir":' + object.Dir + ',"Oper":' + object.Oper + ',"Veh":' + object.Veh + ',"Spd":' + object.Spd + ',"Hdg":' + object.Hdg + ',"Acc":' + object.Acc + ',"Dl":' + object.Dl + ',"Odo":' + object.Odo + ',"Drst":' + object.Drst + ',"Identifier":"' + object.HSLidentifier + '"},"geometry":' + GeoJSONgeometry(object.Lat, object.Long) + '}';
    return feature;
}

function GeoJSON_HSLCollection(array) {
    let JSON = '{"type":"FeatureCollection","features":[';
    if (array.length != 0) {
        JSON = JSON + GeoJSON_HSL(array[0]);
        for (var i = 1; i < array.length; i++) {
            JSON = JSON + ',' + GeoJSON_HSL(array[i]);
        }
    }
    JSON = JSON + ']}';
    //console.log(JSON);
    return JSON;
}

function updateSidePanelHSL(object) {
    if (object.Dest == "Ladataan...") {
        document.getElementById("name").innerHTML = object.Dest;
    } else {
        document.getElementById("name").innerHTML = "Linja: " + object.Desi + ":" + object.Dest;
    }

    document.getElementById("category").innerHTML = object.Type;
    document.getElementById("linja").innerHTML = object.Desi;

    /*
  oper 	Operator name
  6 	Oy Pohjolan Liikenne Ab
  12 	Helsingin Bussiliikenne Oy
  17 	Tammelundin Liikenne Oy
  18 	Pohjolan Kaupunkiliikenne Oy
  19 	Etelä-Suomen Linjaliikenne Oy
  20 	Bus Travel Åbergin Linja Oy
  21 	Bus Travel Oy Reissu Ruoti
  22 	Nobina Finland Oy
  36 	Nurmijärven Linja Oy
  40 	HKL-Raitioliikenne
  45 	Transdev Vantaa Oy
  47 	Taksikuljetus Oy
  51 	Korsisaari Oy
  54 	V-S Bussipalvelut Oy
  55 	Transdev Helsinki Oy
  58 	Koillisen Liikennepalvelut Oy
  59 	Tilausliikenne Nikkanen Oy
  90 	VR Oy
  */


    let OperText;
    switch (object.Oper) {
        case 6:
            OperText = "Oy Pohjolan Liikenne Ab";
            break;
        case 12:
            OperText = "Helsingin Bussiliikenne Oy";
            break;
        case 17:
            OperText = "Tammelundin Liikenne Oy";
            break;
        case 18:
            OperText = "Pohjolan Kaupunkiliikenne Oy";
            break;
        case 19:
            OperText = "Etelä-Suomen Linjaliikenne Oy";
            break;
        case 20:
            OperText = "Bus Travel Åbergin Linja Oy";
            break;
        case 21:
            OperText = "Bus Travel Oy Reissu Ruoti";
            break;
        case 22:
            OperText = "Nobina Finland Oy";
            break;
        case 36:
            OperText = "Nurmijärven Linja Oy";
            break;
        case 40:
            OperText = "HKL-Raitioliikenne";
            break;
        case 45:
            OperText = "Transdev Vantaa Oy";
            break;
        case 47:
            OperText = "Taksikuljetus Oy";
            break;
        case 51:
            OperText = "Korsisaari Oy";
            break;
        case 54:
            OperText = "V-S Bussipalvelut Oy";
            break;
        case 55:
            OperText = "Transdev Helsinki Oy";
            break;
        case 58:
            OperText = "Koillisen Liikennepalvelut Oy";
            break;
        case 59:
            OperText = "Tilausliikenne Nikkanen Oy";
            break;
        case 90:
            OperText = "VR Oy";
            break;
        default:
            OperText = "-";
            break;
    }
    document.getElementById("operator").innerHTML = OperText;

    document.getElementById("Speed").innerHTML = (object.Spd * 3.6).toFixed(1);
    document.getElementById("Acc").innerHTML = object.Acc;

    if (object.Drst == 0) {
        document.getElementById("Doors").innerHTML = "kiinni";
    } else if (object.Drst == 1) {
        document.getElementById("Doors").innerHTML = "auki";
    } else {
        document.getElementById("Doors").innerHTML = "-";
    }

    if (object.Dl >= 0) {
        document.getElementById("Delay").innerHTML = object.Dl;
        document.getElementById("DelayText").innerHTML = "Etuajassa: ";
        document.getElementById("Delay").classList.remove("red");
        document.getElementById("Delay").classList.add("green");
    } else {
        document.getElementById("Delay").innerHTML = object.Dl;
        document.getElementById("DelayText").innerHTML = "jäljessä: ";
        document.getElementById("Delay").classList.add("red");
        document.getElementById("Delay").classList.remove("green");
    }

    document.getElementById("lähti").innerHTML = object.Start;
}