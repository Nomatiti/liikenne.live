var trainStations = [];
var allTrains = [];

function trainComingToStation(trainNumber, trainType, scheduledArrival, actualArrival, arrivalDifference, scheduledDeparture, actualDeparture, departureDifference, track) {
  this.TrainName = trainType + ' ' + trainNumber;
  this.ScheduledArrival = scheduledArrival;
  this.ActualArrival = actualArrival;
  this.ArrivalDifference = arrivalDifference;
  this.ScheduledDeparture = scheduledDeparture;
  this.ActualDeparture = actualDeparture;
  this.DepartureDifference = departureDifference;
  this.Track = track;
}

function printTime(row, scheduled, actual, difference) {
  let cell = row.insertCell(-1);
  let actualSpan = document.createElement('span');
  let scheduleText;

  if (actual == undefined) {
    actualSpan.appendChild(document.createTextNode(''));
    scheduleText = document.createTextNode(prettyTime(new Date(scheduled)));

  } else {
    actualSpan.appendChild(document.createTextNode(prettyTime(new Date(actual))));
    scheduleText = document.createTextNode(' (' + prettyTime(new Date(scheduled)) + ')');

    if (difference != undefined) {
      if (difference > 0) {
        actualSpan.classList.add('red');
      }
      if (difference < 0) {
        actualSpan.classList.add('green');
      }
    }
  }

  cell.appendChild(actualSpan);
  cell.appendChild(scheduleText);
}

var array = [new trainComingToStation('1', 'IC', 1548325800*1000, 1548325920*1000, 2, 1548326400*1000, undefined, undefined, 1), new trainComingToStation('2', 'IC', 1548325920*1000, 1548325800*1000, -2, 1548326400*1000, undefined, undefined, 2), new trainComingToStation('3', 'IC', undefined, undefined, undefined, undefined, undefined, undefined, 3)];

function updateTrains(trainsArray) {
  let table = document.getElementById('stationTable');

  //Remove old lines from table
  for (var i = table.rows.length - 1; i > 0; i--) {
    table.deleteRow(i);
  }

  trainsArray.forEach(function (train) {
    let row = table.insertRow(-1);

    //Train name cell
    row.insertCell(-1).appendChild(document.createTextNode(train.TrainName));

    //Add saapuu cell
    printTime(row, train.ScheduledArrival, train.ActualArrival, train.ArrivalDifference);

    row.insertCell(-1).appendChild(document.createTextNode(train.Track));

    //Add lähtee cell
    printTime(row, train.ScheduledDeparture, train.ActualDeparture, train.DepartureDifference);
  });

}

updateTrains(array);

function parseTrainsComingToStation(UICCode, message, array) {
  let timetable = message.timeTableRows;


}