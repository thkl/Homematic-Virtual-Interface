'use strict';

var winston	= require('winston');
var DailyRotateLogFile = require('winston-daily-rotate-file');
var fs	= require('fs');
var path = require('path');
var os = require('os');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}

var logger = function (prefix) {
  var logPath = path.normalize(appRoot+"/../log/");
  
  if (!fs.existsSync(logPath)){
    fs.mkdirSync(logPath);
  }


  var filename = path.join(logPath, 'hm_vi_log');
  var log = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
	    colorize: true,
        timestamp:timestamp,
        label: prefix || ''
    }),
    new DailyRotateLogFile({ 
	    filename: filename,
	    timestamp:timestamp,
        label: prefix || ''
 	})
  ],
  
  });
  
  return log;
}


function timestamp() {
    var ts = new Date();
    var result = "[" + ts.getFullYear() + '-';

    var value = ts.getMonth() + 1;
    if (value < 10) value = '0' + value;
    result += value + '-';

    value = ts.getDate();
    if (value < 10) value = '0' + value;
    result += value + ' ';

    value = ts.getHours();
    if (value < 10) value = '0' + value;
    result += value + ':';

    value = ts.getMinutes();
    if (value < 10) value = '0' + value;
    result += value + ':';

    value = ts.getSeconds();
    if (value < 10) value = '0' + value;
    result += value + '.';


    value = ts.getMilliseconds();
    if (value < 10) {
        value = '00' + value;
    } else
    if (value < 100) {
        value = '0' + value;
    }

    result += value + ']';

    return result;
}

module.exports = logger;