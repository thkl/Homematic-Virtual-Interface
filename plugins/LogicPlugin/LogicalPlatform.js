//
//  LogicalPlatform.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 30.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
//  Scriptengine adapted from https://github.com/hobbyquaker/mqtt-scripts/

"use strict";


var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var logicLogger = require(appRoot + "/logger.js").logger("LogicLogger");
var xmlrpc = require(appRoot + "/homematic-xmlrpc");

var modules = {
    'fs': require('fs'),
    'path': require('path'),
    'vm': require('vm'),
    'domain': require('domain'),
    'node-schedule': require('node-schedule'),
    'suncalc': require('suncalc'),
    'url': require('url'),
    'promise':require('promise'),
    'http' : require("http"),
    'moment':require("moment"),
    'regarequest' : require(appRoot + "/HomematicReqaRequest.js")

};

var domain = modules.domain;
var vm = modules.vm;
var fs = modules.fs;
var path = modules.path;
var scheduler = modules['node-schedule'];
var suncalc = modules.suncalc;
var url = modules.url;
var http = modules.http;
var regarequest = modules.regarequest;
var Promise = modules.promise;
var moment = modules.moment;
const util = require('util');


var _global = {};

function LogicalPlatform(plugin,name,server,log,instance) {
	LogicalPlatform.super_.apply(this,arguments);
	this.scripts = {};
    this.subscriptions = [];
	this.sunEvents = [];
	this.sunTimes = [/* yesterday */ {}, /* today */ {}, /* tomorrow */ {}];
}

util.inherits(LogicalPlatform, HomematicVirtualPlatform);

LogicalPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	this.log.info("Init %s",this.name);
	var localIP = this.hm_layer.getIPAddress();
	
	logicLogger.info("Logical Bridge is starting");
	
	// Add myself to COre Event Notifier

	this.bridge.addRPCClient('BidCos-RF')
	
	this.hm_layer.addEventNotifier(function (){

		that.hm_layer.on('ccu_datapointchange_event', function(strIf, channel,datapoint,value){
			that.log.debug("CCU Event %s %s %s %s",strIf,channel,datapoint,value)        
    	    that.ccuEvent(strIf + "." +channel,datapoint,value)
		})
		that.log.debug("Done adding Event Listener")        
	})
    
	this.calculateSunTimes();
	this.reInitScripts();
}

LogicalPlatform.prototype.shutdown = function() {
	this.log.debug("Logic Plugin Shutdown");
	Object.keys(scheduler.scheduledJobs).forEach(function(job){
	   scheduler.cancelJob(job); 
    });
}


LogicalPlatform.prototype.regaCommand = function(script,callback) {
  new regarequest(this.hm_layer,script,callback);
}

LogicalPlatform.prototype.reInitScripts = function() {
	var that = this;
	// Kill all and Init 
	this.scripts = {};
    this.subscriptions = [];
    // Kill All Scheduled Jobs

    Object.keys(scheduler.scheduledJobs).forEach(function(job){
	   scheduler.cancelJob(job); 
    });
   
    var l_path = this.configuration.storagePath();
    this.loadScriptDir(l_path + "/scripts/");
    
    scheduler.scheduleJob("[Intern] Astro Calculation",'0 0 * * *', function () {
    // re-calculate every day
    	that.calculateSunTimes();
    // schedule events for this day
    	that.sunEvents.forEach(function (event) {
        	that.sunScheduleEvent(event);
    	});
    	
        that.log.info('re-scheduled', that.sunEvents.length, 'sun events');
    });

}

LogicalPlatform.prototype.loadScriptDir = function(pathName) {
    var that = this;
    
    fs.readdir(pathName, function (err, data) {
        if (err) {
            if (err.errno = 34) {
                that.log.error('directory %s not found',path.resolve(pathName));
            } else {
                that.log.error('readdir %s %s', pathName, err);
            }

        } else {
            data.sort().forEach(function (file) {
                if (file.match(/\.(js)$/)) {
                    that.loadScript(path.join(pathName, file));
                }
            });
            
        }
    });
}


LogicalPlatform.prototype.loadScript = function(filename) {
	var that = this;
	
	if (this.scripts[filename]) {
        this.log.error('Huuuh %s already loaded?!',filename);
        return;
    }
    
    this.log.info('loading script %s',filename);
    
    fs.readFile(filename, function (err, src) {
     
        if (err && err.code === 'ENOENT') {
            that.log.error('%s not found',filename);
        } else if (err) {
            that.log.error(file, err);
        } else {
	        
	        if (filename.match(/\.js$/)) {
                // Javascript
                that.scripts[filename] = {};
                that.scripts[filename].file = filename;
                that.scripts[filename].script = that.createScript(src, filename);
            }
            if (that.scripts[filename]) {
                that.runScript(that.scripts[filename], filename);
            }
	    }
	});    
}

LogicalPlatform.prototype.createScript = function(source, name) {

    this.log.debug('compiling %s',name);
    try {
        if (!process.versions.node.match(/^0\.10\./)) {
            // Node.js >= 0.12, io.js
            return new vm.Script(source, {filename: name});
        } else {
            // Node.js 0.10.x
            return vm.createScript(source, name);
        }
    } catch (e) {
        this.log.error(name, e.name + ':', e.message);
        return false;
    }
}


LogicalPlatform.prototype.sendValueRPC = function(interf,adress,datapoint,value,callback) {
	var that = this;
	this.bridge.callRPCMethod(interf,'setValue',[adress,datapoint,value], function(error, value) {
		that.bridge.doCache(interf,adress,datapoint,value);
		callback();
	});
}

LogicalPlatform.prototype.internal_getState = function(interf,adress,datapoint,callback) {
	var that = this;
	this.bridge.callRPCMethod(interf,'getValue', [adress,datapoint], function(error, value) {
		that.bridge.doCache(interf,adress,datapoint,value);
		callback(value);
	});
}

LogicalPlatform.prototype.get_State = function(interf,adress,datapoint,callback) {
  this.internal_getState(interfmadress,datapoint,callback);
}

LogicalPlatform.prototype.get_Value = function(interf,adress,datapoint,callback) {
	
	var value = this.bridge.getCachedState(interf,adress,datapoint)

	if (value) {
		callback(value);
	} else {
		this.internal_getState(interf,adress,datapoint,callback);
	}

}

LogicalPlatform.prototype.set_Variable = function(name,value,callback) {
   var script = "var x = dom.GetObject('"+name+"');if (x){x.State("+value+");}";
   this.regaCommand(script,callback);
}

LogicalPlatform.prototype.get_Variable = function(name,callback) {
   var script = "var x = dom.GetObject('"+name+"');if (x){WriteLine(x.Variable())	;}";
   this.regaCommand(script,callback);
}

LogicalPlatform.prototype.get_Variables = function(variables,callback) {
   var that = this;
   var script = "object x;";
   variables.forEach(function (variable){
   	script = script + "x=dom.GetObject('" + variable + "');if (x){WriteLine(x#'\t\t'#x.Variable()#'\t\t'#x.Timestamp());}"
   });
   
   var vr_result = {};
   this.regaCommand(script,function (result){
	   var arr = result.split("\r\n");
	   
	   arr.forEach(function(var_line){
		   var vr = var_line.split("\t\t");
		   var nv = {};
		   if ((vr.length>1) && (vr[0]) && (vr[0]!='')) {
			   nv.value = vr[1];
			   if (vr.length>2) {
				   nv.timestamp = moment.utc(vr[2]).valueOf();
			   }
			   vr_result[vr[0]]=nv;
		   }
	   });
	   callback(vr_result);
   });
}


LogicalPlatform.prototype.set_Variables = function(variables,callback) {
   var that = this;
   var script = "object x;";
   Object.keys(variables).forEach(function(key) {
   	var vv = variables[key];
   	if (vv) {
       script = script + "x=dom.GetObject('" + key + "');if (x){x.State("+vv+");}"
   	}
   });
   this.regaCommand(script,function (result){
	   callback();
   });
}


LogicalPlatform.prototype.executeCCUProgram = function(programName,callback) {
   var that = this;
   var script = "var x=dom.GetObject('" + programName + "');if (x){x.ProgramExecute();}"
   this.regaCommand(script,function (result){
	   that.log.debug("Launched %s",programName);
	   callback(result);
   });
}

LogicalPlatform.prototype.fetchMessages = function(callback) {
   var that = this;
   var script = "boolean df = true;Write(\'{\"messages\":[\');var i=dom.GetObject(41);if(i.State()>0){var s=dom.GetObject(ID_SERVICES);string sid;foreach(sid,s.EnumIDs()){var o=dom.GetObject(sid);if (o.AlState()==asOncoming){if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\'#sid#\'\",\');Write(\'\"obj\": \"\'#o.Name()#\'\",\');var n = dom.GetObject(o.AlTriggerDP());if ((n) && (n.Device())) {var d=dom.GetObject(n.Device());Write(\'\"trg\":\"\'#d.Name()#\'\",\');}Write(\'\"time\":\"\'#o.Timestamp()#\'\"}\');}}}Write(\']}\');"
   
   this.regaCommand(script,function (result){
	   try {
		   var obj = JSON.parse(result);
		   callback(obj);
 	   } catch (e) {
	 	   that.error(e);
	   }
   });
}


LogicalPlatform.prototype.confirmMessages = function(messages,callback) {
   var that = this;
   var script = "var o;"
   messages.some(function (message){
	  script = script + "o=dom.GetObject(" + message.id + ");if(o.State()==true){o.AlReceipt();}"
   });
   
   this.regaCommand(script,function (result){
	   try {
		   callback();
 	   } catch (e) {
	 	   that.error(e);
	   }
   });
}



LogicalPlatform.prototype.ccuEvent = function(adress,datapoint,value) {
   this.processSubscriptions(adress,datapoint,value );
}


LogicalPlatform.prototype.processSubscriptions = function(adress,datapoint,value) {
  var that = this;
  
  var eventSource = adress+"."+datapoint;
  this.subscriptions.forEach(function (subs) {

	  var options = subs.options || {};
      var delay;
      var match;

	  if (typeof subs.source === 'string') {
            match = (subs.source == eventSource);
        } else if (subs.source instanceof RegExp) {
            match = eventSource.match(subs.source);
        }

      if (typeof subs.callback === 'function' && match) {
      		
      		delay = 0;
            if (options.shift) delay += ((parseFloat(options.shift) || 0) * 1000);
            if (options.random) delay += ((parseFloat(options.random) || 0)  * Math.random() * 1000);

            delay = Math.floor(delay);
            setTimeout(function () {
                subs.callback(subs.source, value);
            }, delay);

        }	  
	  
  });
}

LogicalPlatform.prototype.getDatabase = function(name) {
	var spath = this.configuration.storagePath()
	// Do not store outside the config file
	try {
		var Datastore = require('nedb')
		var db = new Datastore({ filename: path.join(spath,path.basename(name)+".udb")})
		db.loadDatabase(function (err) {    // Callback is optional
				// Now commands will be executed
				if (err) {
					this.log.error("Error while loading custom db %s",err)
				}
		});
		return db
	} catch (e) {
		this.log.error("Error while initializing custom db %s",e)
	}
}


LogicalPlatform.prototype.calculateSunTimes = function() {
    var now = new Date();
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0, 0);
    var yesterday = new Date(today.getTime() - 86400000); //(24 * 60 * 60 * 1000));
    var tomorrow = new Date(today.getTime() + 86400000); //(24 * 60 * 60 * 1000));
    var lat = this.configuration.getValueForPluginWithDefault(this.name,"latitude",52.520008); // Default is Berlin ;o)
    var lon = this.configuration.getValueForPluginWithDefault(this.name,"longitude",13.404954);

    this.sunTimes = [
        suncalc.getTimes(yesterday, lat, lon),
        suncalc.getTimes(today, lat, lon),
        suncalc.getTimes(tomorrow, lat, lon)
    ];
    this.log.debug('calculatedSunTimes', this.sunTimes);
}


LogicalPlatform.prototype.sunScheduleEvent = function(obj, shift) {
    // shift = -1 -> yesterday
    // shift = 0 -> today
    // shift = 1 -> tomorrow
    var event = this.sunTimes[1 + (shift || 0)][obj.pattern];
    log.debug('sunScheduleEvent', obj.pattern, obj.options, shift);
    var now = new Date();

    if (event.toString() !== 'Invalid Date') {
        // Event will occur today

        if (obj.options.shift) event = new Date(event.getTime() + ((parseFloat(obj.options.shift) || 0) * 1000));

        if ((event.getDate() !== now.getDate()) && (typeof shift === 'undefined')) {
            // event shifted to previous or next day
            this.sunScheduleEvent(obj, (event < now) ? 1 : -1);
            return;
        }

        if ((now.getTime() - event.getTime()) < 1000) {
            // event is less than 1s in the past or occurs later this day

            if (obj.options.random) {
                event = new Date(
                    event.getTime() +
                    (Math.floor((parseFloat(obj.options.random) || 0) * Math.random()) * 1000)
                );
            }

            if ((event.getTime() - now.getTime()) < 1000)  {
                // event is less than 1s in the future or already in the past
                // (options.random may have shifted us further to the past)
                // call the callback immediately!
                obj.domain.bind(obj.callback)();

            } else {
                // schedule the event!
                scheduler.scheduleJob(event, obj.domain.bind(obj.callback));
                this.log.debug('scheduled', obj.pattern, obj.options, event);
            }

        } else {
            this.log.debug(obj.pattern, obj.options, 'is more than 1s the past', now, event);
        }

    } else {
        this.log.debug(obj.pattern, 'doesn\'t occur today');
    }
}



LogicalPlatform.prototype.triggerScript = function(script) {
  var that = this;
  var found = false;
    
  
  // First check if we have to run out from subscriptions
  
  this.subscriptions.forEach(function (subs) {
    var match = (subs.file == script);

  		if (typeof subs.callback === 'function' && match) {
	  		that.log.debug("Found %s with a subscription - run the then part",script);
	  		subs.callback(null,null);
		    found = true;
		}
  });
  
  if (!found) {
	  // Not found as a Subscripttion .. get the script and run manually
  var l_path = this.configuration.storagePath();
  var sfile = l_path + "/scripts/" + script;
  var oscript = this.scripts[sfile];
  if (oscript) {
	  // Check Callback and Run it
	  	
	  	this.log.debug("Not found in subscriptions - load and run %s",sfile);
		fs.readFile(sfile, function (err, src) {
     
        if (err && err.code === 'ENOENT') {
            that.log.error('%s not found',sfile);
        } else if (err) {
            that.log.error(file, err);
        } else {
	        
	        if (sfile.match(/\.js$/)) {
                // Javascript
                var triggeredScript = that.createScript(src, sfile);
                that.runScript(triggeredScript, sfile);
            }
	    }
	});    
  }
	  
  }
  this.log.debug("Subscriptions : ",JSON.stringify(this.subscriptions));
}

LogicalPlatform.prototype.httpCall = function(method,aUrl,parameter,callback) {
  this.log.debug("HTTP CALL : %s %s %s",method,aUrl,parameter);
  
  try {
	  var util = require(path.join(appRoot, "Util.js"));
	  util.httpCall(method,aUrl,parameter,callback)
  } catch (err) {
	  that.log.error(err.stack)
  }
}


LogicalPlatform.prototype.runScript = function(script_object, name) {
	var script = script_object.script;
    var scriptDir = path.dirname(path.resolve(name));
	var that = this;
	
    this.log.debug('creating domain %s',name);
    var scriptDomain = domain.create();
	
    this.log.debug('creating sandbox %s',name);

    var Sandbox = {

        global: _global,

        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,

        Buffer: Buffer,

        require: function (md) {
	        
	        if (modules[md]) return modules[md];
            
            try {
                var tmp;
                if (md.match(/^\.\//) || md.match(/^\.\.\//)) {
                    tmp = './' + path.relative(__dirname, path.join(scriptDir, md));
                } else {
                    tmp = md;
                    if (fs.existsSync(path.join(scriptDir, 'node_modules', md, 'package.json'))) {
                        tmp = './' + path.relative(__dirname, path.join(scriptDir, 'node_modules', md));
                        tmp = path.resolve(tmp);
                    }
                }
                Sandbox.log.debug('require', tmp);
                modules[md] = require(tmp);
                return modules[md];

            } catch (e) {
                var lines = e.stack.split('\n');
                var stack = [];
                for (var i = 6; i < lines.length; i++) {
                    if (lines[i].match(/runInContext/)) break;
                    stack.push(lines[i]);
                }
                log.error(name + ': ' + e.message + '\n' + stack);
            }
	        
        },
        
        log: {
            /**
             * Log a debug message
             * @memberof log
             * @method debug
             * @param {...*}
             */
            debug: function () {
                var args = Array.prototype.slice.call(arguments);
				var rep = args.slice(1, args.length);
				var i=0;
				var output = args[0];
				if ((typeof args[0])=="string") {
					 output = args[0].replace(/%s/g, function(match,idx) {
						var subst=rep.slice(i, ++i).toString();
						return( subst );
					});
				}
                logicLogger.debug(name + ':' + output);
            },
            /**
             * Log an info message
             * @memberof log
             * @method info
             * @param {...*}
             */
            info: function () {
                var args = Array.prototype.slice.call(arguments);
				var rep = args.slice(1, args.length);
				var i=0;
				var output = args[0];
				if ((typeof args[0])=="string") {
					 output = args[0].replace(/%s/g, function(match,idx) {
						var subst=rep.slice(i, ++i).toString();
						return( subst );
					});
				}
				
				logicLogger.info(name + ':' + output);
            },
            /**
             * Log a warning message
             * @memberof log
             * @method warn
             * @param {...*}
             */
            warn: function () {
                var args = Array.prototype.slice.call(arguments);
				var rep = args.slice(1, args.length);
				var i=0;
				var output = args[0];
				if ((typeof args[0])=="string") {
					 output = args[0].replace(/%s/g, function(match,idx) {
						var subst=rep.slice(i, ++i).toString();
						return( subst );
					});
				}
                logicLogger.warn(name + ':' + output);
            },
            /**
             * Log an error message
             * @memberof log
             * @method error
             * @param {...*}
             */
            error: function () {
                var args = Array.prototype.slice.call(arguments);
				var rep = args.slice(1, args.length);
				var i=0;
				var output = args[0];
				if ((typeof args[0])=="string") {
					 output = args[0].replace(/%s/g, function(match,idx) {
						var subst=rep.slice(i, ++i).toString();
						return( subst );
					});
				}
                logicLogger.error(name + ':' + output);
            }
        },
        
        link: function Sandbox_link(source, target, /* optional */ value) {
            Sandbox.subscribe(source, function (source, val) {
                val = (typeof value === 'undefined') ? val : value;
                that.log.debug('logic-link', source, target, val);
                Sandbox.setValue(target, val);
            });
        },
        
        subscribe:  function Sandbox_subscribe(source, /* optional */ options, callback) {
            if (typeof source === 'undefined') {
                throw(new Error('argument source missing'));
            }

            if (arguments.length === 2) {

                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function');

                callback = arguments[1];
                options = {};


            } else if (arguments.length === 3) {

                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function');
                options = arguments[1] || {};
                callback = arguments[2];

            } else if (arguments.length > 3) {
                throw(new Error('wrong number of arguments'));
            }

            if (typeof source === 'string') {
				
				var tmp = source.split('.');
				// Check first Value for hmvirtual
			    that.log.debug("Source is %s",JSON.stringify(tmp));
				if ((tmp.length>2) && (tmp[0].toLowerCase()=="hmvirtual")) {
					
				   var channel = tmp[1];
				   // Bind to channel change events
				   that.processLogicalBinding(channel);
				}
                
                var fn = path.basename(name)
                that.subscriptions.push({file:fn, source: source, options: options, callback: (typeof callback === 'function') && scriptDomain.bind(callback)});

            } else if (typeof source === 'object' && source.length) {

                source = Array.prototype.slice.call(source);
                source.forEach(function (tp) {
	                Sandbox.subscribe(tp, options, callback);
                });

            }

        },
        
        
        setVariable:   function Sandbox_setVariable(varname, val) {
        	return new Promise(function (resolve,reject) {
				that.set_Variable(varname,val,function(){
					resolve(val);
				});
	        });
        },
        
        setVariables:   function Sandbox_setVariables(variables) {
        	
        	return new Promise(function (resolve,reject) {
			try {
				that.set_Variables(variables,function(){
					resolve(variables);
				});
			} catch (err) {
				that.log.debug(err);
				reject(err);
			}
	        });
        },

        getVariable:   function Sandbox_getVariable(varname) {
        	return new Promise(function (resolve,reject) {
				that.get_Variable(varname,function(value){
					resolve(value);
				});
	        }	);
        },
       
        fetchMessages:   function Sandbox_fetchMessages() {
        	return new Promise(function (resolve,reject) {
				that.fetchMessages(function(value){
					resolve(value);
				});
	        }	);
        }, 

        confirmMessages:   function Sandbox_confirmMessages(messages) {
        	return new Promise(function (resolve,reject) {
				that.confirmMessages(messages,function(value){
					resolve(value);
				});
	        }	);
        }, 
        
        getDatabase: function Sandbox_getDatabase(name) {
	        return that.getDatabase(name)
        },

        getVariables:   function Sandbox_get_Variables(varnames) {
        	return new Promise(function (resolve,reject) {
				that.get_Variables(varnames,function(values){
					resolve(values);
				});
	        }	);
        },
        
        setName : function Sandbox_setName(nameOfScript) {
	        script_object.name = nameOfScript;
        },
        
        setDescription : function Sandbox_setDescription(description) {
	        script_object.description = description;
        },

		regaCommand : function Sandbox_regaCommand(command) {
	        return new Promise(function (resolve,reject) {
				that.regaCommand(command,function(resp){
					resolve(resp);
				});
	        });
        },

		executeCCUProgram : function Sandbox_executeCCUProgram(programName) {
	        return new Promise(function (resolve,reject) {
				that.executeCCUProgram(programName,function(resp){
					resolve(resp);
				});
	        });
        },

        setValue:   function Sandbox_setValue(target, val) {

			return new Promise(function (resolve,reject) {

            if (typeof target === 'object' && target.length) {
                target = Array.prototype.slice.call(target);
                target.forEach(function (tp) {
                    Sandbox.setValue(tp, val);
                    resolve(value);
                });
                return;
            }

			var tmp = target.split('.');
			// First Part should be the interface
			// Second the Adress
			// third the Datapoint
			if (tmp.length>2) {
				
				if (tmp[0].toLowerCase()=="hmvirtual") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					var channel = that.hm_layer.channelWithAdress(adress);
					if (channel) {
						that.log.debug("Channel found set Value");
						channel.setValue(datapointName,val);
						channel.updateValue(datapointName,val,true);
						resolve();
					} else {
						that.log.error("Channel %s not found",adress);
					}
				} else {
					var adress = tmp[1];
					var datapointName = tmp[2];
					that.sendValueRPC(tmp[0],adress,datapointName,val,function(){
						resolve();
					}); 
				}
				
				
			} else {
				that.log.error("Target %s seems not to be value",target);
				reject(undefined);
			}
			
		  });
		},
		
		getValue: function Sandbox_getValue(target) {
			
			return new Promise(function (resolve,reject) {
				
   			var tmp = target.split('.');
   			//if (typeof callback === 'function') {
			// First Part should be the interface
			// Second the Adress
			// third the Datapoint
			if (tmp.length>2) {
				
				if (tmp[0].toLowerCase()=="hmvirtual") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					var channel = that.hm_layer.channelWithAdress(adress);
					if (channel) {
						resolve(channel.getValue(datapointName));
					}
				} else {
					var adress = tmp[1];
					var datapointName = tmp[2];
				    that.get_Value(tmp[0],adress,datapointName,function(value){
					    resolve(value);
				    });
				}
				
				
			} else {
				that.log.error("Target %s seems not to be value",target);
				reject(undefined);
			}
				
			});
		  //}
		},

		getState: function Sandbox_getState(target,callback) {
		
			return new Promise(function (resolve,reject) {
   			var tmp = target.split('.');
			// First Part should be the interface
			// Second the Adress
			// third the Datapoint
			if (tmp.length>2) {
				
				if (tmp[0].toLowerCase()=="hmvirtual") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					var channel = that.hm_layer.channelWithAdress(adress);
					if (channel) {
						resolve(channel.getValue(datapointName));
					}
				} else {
					var adress = tmp[1];
					var datapointName = tmp[2];
				    that.get_State(tmp[0],adress,datapointName,function(value){
					    resolve(value);
				    });
				}
				
				
			} else {
				that.log.error("Target %s seems not to be value",target);
				reject(undefined);
			}

			});
		},
		
		httpCall: function Sandbox_httpCall(method,url,parameter) {

			if (arguments.length == 2) {
				var parameter = {}
			}
			
			return new Promise(function (resolve,reject) {
					that.httpCall(method,url,parameter,function (result,error) {
						resolve(result,error);
					});
			})
		},

		schedule:   function Sandbox_schedule(pattern, /* optional */ options, callback) {

            if (arguments.length === 2) {
                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function');
                callback = arguments[1];
                options = {};
            } else if (arguments.length === 3) {
                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function');
                options = arguments[1] || {};
                callback = arguments[2];
            } else {
                throw(new Error('wrong number of arguments'));
            }

            if (typeof pattern === 'object' && pattern.length) {
                pattern = Array.prototype.slice.call(topic);
                pattern.forEach(function (pt) {
                    Sandbox.sunSchedule(pt, options, callback);
                });
                return;
            }

            that.log.debug('schedule()', pattern, options, typeof callback);
			if (options.name==undefined) {
				options.name = "JOB:314";
			}
            if (options.random) {
                scheduler.scheduleJob(options.name, pattern, function () {
                    setTimeout(scriptDomain.bind(callback), (parseFloat(options.random) || 0) * 1000 * Math.random());
                });
            } else {
	            var job = scheduler.scheduleJob(options.name,pattern, scriptDomain.bind(callback));
            }


        },
        
        sunSchedule: function Sandbox_sunSchedule(pattern, /* optional */ options, callback) {

            if (arguments.length === 2) {
                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function');
                callback = arguments[1];
                options = {};
            } else if (arguments.length === 3) {
                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function');
                options = arguments[1] || {};
                callback = arguments[2];
            } else {
                throw new Error('wrong number of arguments');
            }

            if ((typeof options.shift !== 'undefined') && (options.shift < -86400 || options.shift > 86400)) {
                throw new Error('options.shift out of range');
            }

            if (typeof pattern === 'object' && pattern.length) {
                pattern = Array.prototype.slice.call(topic);
                pattern.forEach(function (pt) {
                    Sandbox.sunSchedule(pt, options, callback);
                });
                return;
            }

            that.log.debug('sunSchedule', pattern, options);

            var event = sunTimes[0][pattern];
            if (typeof event === 'undefined') throw new Error('unknown suncalc event ' + pattern);

            var obj = {
                pattern: pattern,
                options: options,
                callback: callback,
                context: Sandbox,
                domain: scriptDomain
            };

            that.sunEvents.push(obj);

            that.sunScheduleEvent(obj);

        }
        
        
    };
    
     Sandbox.console = {
        log: Sandbox.log.info,
        error: Sandbox.log.error
    };


    this.log.debug('contextifying sandbox %s',name);
    var context = vm.createContext(Sandbox);


    scriptDomain.on('error', function (e) {
        if (!e.stack) {
            that.log.error.apply(log, [name + ' unkown exception']);
            return;
        }
        var lines = e.stack.split('\n');
        var stack = [];
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].match(/\[as runInContext\]/)) break;
            stack.push(lines[i]);
        }

        that.log.error.apply(that.log, [name + ' ' + stack.join('\n')]);
    });

    scriptDomain.run(function () {
        that.log.debug('running %s',name);
        try {
	        script.runInContext(context);
        } catch (err) {
	        that.log.error("--------------------");
			that.log.error("ERROR LOADING SCRIPT %s",name);
			that.log.error(err.stack);
			that.log.error("--------------------");
			
        }
    });

}

LogicalPlatform.prototype.processLogicalBinding = function(source_adress) {
  var channel = this.hm_layer.channelWithAdress(source_adress);
  var that = this;
  if (channel) {
	  that.log.debug("uhh someone is intrested in my value changes %s",source_adress);
	  
	  channel.removeAllListeners("logicevent_channel_value_change");
	  
	  channel.on('logicevent_channel_value_change', function(parameter){
		  
		 parameter.parameters.forEach(function (pp){
		  that.log.debug("Channel was updated processing subscription ","HMVirtual."+parameter.channel,pp.name,pp.value);
		  that.processSubscriptions("HMVirtual."+parameter.channel,pp.name,pp.value);
		});
		
	  });	
	  
  } else {
	  that.log.debug("channel with adress %s not found - cannot add event listener",source_adress);
  }
}






LogicalPlatform.prototype.getValue = function(adress) {
   return this.elements[adress];
}

LogicalPlatform.prototype.shutdown = function() {

	
}

LogicalPlatform.prototype.deleteScript = function(scriptName) {
try {
	var l_path = this.configuration.storagePath()+"/scripts/";
	scriptName = scriptName.replace('..','');
	var file = fs.unlink(l_path + scriptName);
	return file;
} catch (err) {
	this.log.debug(err);
	return "File not found " + scriptName;
}
}

LogicalPlatform.prototype.getScript = function(scriptName) {
try {
	var l_path = this.configuration.storagePath()+"/scripts/";
	scriptName = scriptName.replace('..','');
	var file = fs.readFileSync(l_path + scriptName , "binary");
	return file;
} catch (err) {
	this.log.debug(err);
	return "File not found " + scriptName;
}
}

LogicalPlatform.prototype.saveScript=function(data,filename) {
  try {
 	 fs.writeFileSync(filename, data)
 	 this.reInitScripts();
  } catch (e){this.log.error(e)}
}

LogicalPlatform.prototype.existsScript=function(filename) {
  try {
 	 fs.readFileSync(filename);
 	 return true;
  } catch (e){
	  return false;
  }
}

LogicalPlatform.prototype.validateScript=function(data) {
	// Save as tmp 
	var that = this;
	try {
		var name = "/tmp/hm_tmp_script.js"
		fs.writeFileSync(name, data);
	  
		try {
			if (!process.versions.node.match(/^0\.10\./)) {
            	// Node.js >= 0.12, io.js
            	new vm.Script(data, {filename: name});
				return true;
        	} else {
            	// Node.js 0.10.x
				vm.createScript(data, name);
				return true;
        	}
		} catch (e) {
	      return  e;
      	}
	}	      
	catch (err) {
		return "Filesystem error";
    }
}

LogicalPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var htmlfile = "index.html";
	var editorData = {"error":""};
	var that = this;
	
	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
		
		  case "reload": {
			  this.reInitScripts();
		  }
		  break;
		  
		  case "trigger": {
			  this.triggerScript(queryObject["script"]);
		  }
		  break;

		  case "showlog": {
			  htmlfile = "log.html"
			  var LoggerQuery = require(path.join(appRoot , 'logger.js')).LoggerQuery
			  new LoggerQuery("LogicLogger").query(function (err, result) {
					var str = "";
					result.some(function (msg){
							str = str + msg.time  + "  [" + msg.level + "] - " + msg.msg + "\n";
					})
					
					editorData["content"]=str;
					dispatched_request.dispatchFile(that.plugin.pluginPath , htmlfile ,{"editor":editorData});
 			  	});
			  
			  return;

		  }
		  
		  break;

		  
		  case "edit": {
			  htmlfile = "editor.html";
			  var scriptname = queryObject["file"];
			  var script = this.getScript(scriptname);
			  editorData["file"] = scriptname;
			  editorData["content"] = script; 
			  editorData["new"] = "false"; 
		  }
		  break;
		  
		  case "new": {
			  htmlfile = "editor.html";
			  var scriptname = queryObject["file"];
			  editorData["file"] = "newscript.js";
			  editorData["content"] = ""; 
			  editorData["new"] = "true"; 
		  }
		  break;
		  
		  case "delete": {
			  var scriptname = queryObject["file"];
			  this.deleteScript(scriptname);
			  this.reInitScripts();
			  htmlfile = "reinit.html";
		  }
		  break;
		}
		
	}

    if (dispatched_request.post != undefined) {

	    var content = dispatched_request.post["editor.content"];
	    var fileName = dispatched_request.post["script.filename"];
	    var isNew = dispatched_request.post["editor.new"];
	    switch (dispatched_request.post["do"]) {
		    
		    
		    case "script.save": {
			    var result = this.validateScript(content);
			    if (result == true) {
				   var l_path = this.configuration.storagePath()+"/scripts/";
				   fileName = fileName.replace('..','');
				   if ((isNew == "true") && (this.existsScript(l_path + fileName))) {
					   htmlfile = "editor.html";
					   editorData["error"] = "File " + fileName + " exists.";
					   editorData["content"] = content;
					   editorData["file"] = fileName;
					   editorData["new"] = isNew;
				   } else {
					   this.saveScript(content,l_path + fileName);						    
					   htmlfile = "reinit.html";
				   }
			    } else {
				   htmlfile = "editor.html";
				   editorData["error"] = result;
				   editorData["content"] = content;
				   editorData["file"] = fileName;
				   editorData["new"] = isNew;
 			    }
		    }
		    
		    break;
		    
		    case "script.validate": {
			    var result = this.validateScript(content);
			    if (result == true) {
					editorData["error"] = "Validation : ok";
			    } else {
 			    	editorData["error"] = "Validation : " + result;
				}
 				
 				htmlfile = "editor.html";
			    editorData["content"] = content;
				editorData["file"] = fileName;
				editorData["new"] = isNew;

		    }
		    
		    break;

	    }
	    
    }
	
	var strScripts = "";
	var strSchedulers = "";
	var that = this;
	
	var itemtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_item_tmp.html",null);
	var scripttemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_script_tmp.html",null);

	
	Object.keys(scheduler.scheduledJobs).forEach(function(job){
	  strSchedulers = strSchedulers + dispatched_request.fillTemplate(itemtemplate,{"item":job});
	});	
	
	that.log.debug(Object.keys(this.scripts));
	
	var sorted = Object.keys(this.scripts).sort(function(a,b){
		var a = that.scripts[a].name || path.basename(a);
		var b = that.scripts[b].name || path.basename(b);
		if (a < b) return -1;
		if (a > b) return 1;
		return 0;
	});	
	
	that.log.debug(sorted);
	
	sorted.forEach(function(key){
		var script_object = that.scripts[key];
		var data = {
			"script.filename":path.basename(script_object.file),
			"script.desc":script_object.description || "",
			"script.name":script_object.name || path.basename(script_object.file)
			};
			
	  strScripts = strScripts + dispatched_request.fillTemplate(scripttemplate,data);
	});
	
	dispatched_request.dispatchFile(this.plugin.pluginPath , htmlfile ,{"scripts":strScripts,"schedules":strSchedulers,"editor":editorData});
}


module.exports = LogicalPlatform;
