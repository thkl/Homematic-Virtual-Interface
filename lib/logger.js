'use strict';

var DEBUG_ENABLED = false
var fs	= require('fs')
var path = require('path')
var os = require('os')
var util = require('util')
var db = undefined
var logfile = undefined

var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}
appRoot = path.normalize(appRoot);

try {
	var chalk = require('chalk');
} catch (e)
{
	
}

const levels = { 0: "ERROR" , 1:  "WARN" , 2: "INFO" , 3: "VERBOSE" , 4:"DEBUG", 5:"SILLY" }

var logger = function (prefix) {
  
  
  	return {
	
	log : function() {
		var args = Array.prototype.slice.call(arguments)
	    var msg = getRawString(args)
        if (db) {db.insert({'module':prefix,'time':new Date(),'level':3,'msg':msg})}
        logConsoleString(prefix,3,msg)
	},
	info : function() {
		var args = Array.prototype.slice.call(arguments)
	    var msg = getRawString(args)
	    if (db) {db.insert({'module':prefix,'time':new Date(),'level':2,'msg':msg})}
        logConsoleString(prefix,2,msg)
	},
	warn : function() {
		var args = Array.prototype.slice.call(arguments)
	    var msg = getRawString(args)
	    if (db) {db.insert({'module':prefix,'time':new Date(),'level':1,'msg':msg})}
        logConsoleString(prefix,1,msg)
	},
	debug : function() {
        if (DEBUG_ENABLED==true) { 
			var args = Array.prototype.slice.call(arguments)
		    var msg = getRawString(args)
	        if (db) {db.insert({'module':prefix,'time':new Date(),'level':4,'msg':msg})}
	        logConsoleString(prefix,4,msg) 
        }
	},
	error : function() {
		var args = Array.prototype.slice.call(arguments)
	    var msg = getRawString(args)
	    if (db) {db.insert({'module':prefix,'time':new Date(),'level':0,'msg':msg})}
        logConsoleString(prefix,0,msg)
	}
  }
}

function setFileTransport(aLogfile) {
	try {
		var dbLogger = require('nedb-logger')
		logfile = aLogfile
		fs.unlink(logfile);
		console.log("SetFileTransport to %s",logfile)
		db = new dbLogger({ filename: logfile });
	} catch (e) {
		console.log(e)
	}	
}

function getRawString(args){
   var msg = args[0]
   var rep = args.slice(1, args.length);
   if (rep.length>0) {
	   var i = 0
	   var output = msg
	   if ((typeof msg)=="string") {
			output = msg.replace(/%s/g, function(match,idx) {
			   
				var subst=rep.slice(i, ++i);
				return subst.toString();
				
			});
		}
		return output;
   } else {
	   return msg
   }
}

function logConsoleString(prefix,level,message) {
	
	if (chalk) {
	switch (level) {
		case 0 :
			console.log(timestamp() + chalk.cyan(" ["+ prefix + "]") + "[ERROR] " + chalk.red(message));	
		    break;
		case 1 :
			console.log(timestamp() + chalk.cyan(" ["+ prefix + "]") + "[WARN] " + chalk.yellow(message));	
		    break;
		case 2 :
			console.log(timestamp() + chalk.cyan(" ["+ prefix + "]") + "[INFO] " + chalk.white(message));	
		    break;
		case 3 :
			console.log(timestamp() + chalk.cyan(" ["+ prefix + "]") + "[VERBOSE] " + chalk.white(message));	
		    break;
		case 4 :
			console.log(timestamp() + chalk.cyan(" ["+ prefix + "]") + "[DEBUG] " + chalk.gray(message));	
		    break;
	}	
	} else {
	switch (level) {
		case 0 :
			console.log(timestamp() + " ["+ prefix + "]" + "[ERROR] " + message);	
		    break;
		case 1 :
			console.log(timestamp() + " ["+ prefix + "]" + "[WARN] " + message);	
		    break;
		case 2 :
			console.log(timestamp() + " ["+ prefix + "]" + "[INFO] " + message);	
		    break;
		case 3 :
			console.log(timestamp() + " ["+ prefix + "]" + "[VERBOSE] " + message);	
		    break;
		case 4 :
			console.log(timestamp() + " ["+ prefix + "]" + "[DEBUG] " + message);	
		    break;
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




var LoggerQuery = function (prefix) {
	try {
	var Database = require('nedb')
	this.prefix = prefix
	this.db = new Database({ filename: logfile });
	this.db.loadDatabase(function (err) {    // Callback is optional
				// Now commands will be executed
				if (err) {
					console.log("Error while loading logging db %s",err)
				}
		});
	} catch (err) {
					console.log("Error while loading loggin db %s",err)
	}
}	

LoggerQuery.prototype.query = function(callback) {
	this.db.find({ module: this.prefix}).sort({time: -1 }).limit(200).exec(function (err, docs) {
		  if (callback) {
			  docs.some(function(doc){
				 doc.level = levels[doc.level] 
			  });
			  callback(err,docs)
		  }
		});
}		

LoggerQuery.prototype.queryAll = function(callback) {
		this.db.find({}).sort({time: -1 }).limit(200).exec(function (err, docs) {
		  if (callback) {
			  docs.some(function(doc){
				 doc.level = levels[doc.level] 
			  });
			  callback(err,docs)
		  }
		});
}
	
LoggerQuery.prototype.clean = function(hours) {
		var ts = new Date().getTime() - (hours*3600000)
		var that = this
		this.db.insert({'module':"Logging System",'time':new Date(),'level':2,'msg':"Wil remove logentries older than " +  new Date(ts)})
		this.db.remove({time : { $lt: new Date(ts) }}, { multi: true }, function (err, numRemoved) {
			that.db.insert({'module':"Logging System",'time':new Date(),'level':2,'msg':numRemoved + " Logentries removed"})
		});
		this.db.persistence.compactDatafile()
		var dbLogger = require('nedb-logger')
		db = new dbLogger({ filename: logfile });
}



module.exports = {
	logger,
	setDebugEnabled: setDebugEnabled,
	setFileTransport:setFileTransport,
	LoggerQuery:LoggerQuery
}
