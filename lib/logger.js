'use strict';

try {
	var winston	= require('winston');
	var DailyRotateLogFile = require('winston-daily-rotate-file');
} catch (e) {
	console.log("Logger not found ..");
}

var DEBUG_ENABLED = false;
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

  var loglevel = (DEBUG_ENABLED===true) ? 'debug' : 'info';
  var filename = path.join(logPath, 'hm_vi_log');
  try {
  var log = new (winston.Logger)({
  transports: [
    new (winston.transports.Console)({
	    colorize: true,
        timestamp:timestamp,
        label: prefix || '',
        level:loglevel
    }),
    new DailyRotateLogFile({ 
	    filename: filename,
	    timestamp:timestamp,
        label: prefix || '',
        level:'info'
 	})
  ],
  
  });
  
  return log;
  } catch (e) {
	console.log("Will use console to log at this time");
	return {
	
	log : function() {
        console.log(arguments);	
	},
	
	info : function() {
        console.log(arguments);	
	},

	
	warn : function() {
        console.log(arguments);	
	},
	
	debug : function() {
        console.log(arguments);	
	},
	
	error : function() {
		var args = Array.prototype.slice.call(arguments);
        console.log(args);	
		
	}
  }
 }
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



// Turns on debug level logging
function setDebugEnabled(enabled) {
	console.log("Set Loglevel to Debug");
    DEBUG_ENABLED = enabled;
}


module.exports = {
	logger,
	setDebugEnabled: setDebugEnabled
}
