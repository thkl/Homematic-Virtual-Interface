//
//  LogicalBridge.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 30.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
//  Scriptengine adapted from https://github.com/hobbyquaker/mqtt-scripts/

"use strict";

var xmlrpc = require(__dirname + "/../../lib/homematic-xmlrpc");

var modules = {
    'fs': require('fs'),
    'path': require('path'),
    'vm': require('vm'),
    'domain': require('domain'),
    'node-schedule': require('node-schedule'),
    'suncalc': require('suncalc'),
    'url': require('url')
};

var domain = modules.domain;
var vm = modules.vm;
var fs = modules.fs;
var path = modules.path;
var scheduler = modules['node-schedule'];
var suncalc = modules.suncalc;
var url = modules.url;


var _global = {};

var LogicalMapping = function(source_adress,source_datapoint,destination_adress,destination_datapoint,destination_value) {
  this.source_adress = source_adress;
  this.source_datapoint = source_datapoint;
  this.destination_adress = destination_adress;
  this.destination_datapoint = destination_datapoint;
  this.destination_value = destination_value;
}

var LogicalBridge = function(plugin,name,server,log) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.interface = "BidCos-RF.";
	this.scripts = {};
    this.subscriptions = [];
    
	this.sunEvents = [];
	this.sunTimes = [/* yesterday */ {}, /* today */ {}, /* tomorrow */ {}];
}


LogicalBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	this.log.info("Init %s",this.name);
	var port = this.configuration.getValueForPluginWithDefault(this.name,"bridge_port",7002);
	var localIP = this.hm_layer.getIPAddress();
	
	this.server = xmlrpc.createServer({
      host: localIP,
      port: port
    });
    
    
    this.methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
	   	    that.log.debug('rpc < system.listMethods', null, params);
            that.log.debug('repl  >', null, JSON.stringify(Object.keys(that.methods)));
            callback(null,Object.keys(that.methods));
    },
    
    'listDevices': function listDevices(err, params, callback) {
      that.log.debug('rpc <- listDevices Zero Reply');
      callback(null,[]);
    },


    'newDevices': function newDevices(err, params, callback) {
      that.log.debug('rpc <- newDevices Zero Reply');
      callback(null,[]);
    },
   
   
    'event': function event(err, params, callback) {
      that.log.debug('rpc <- event Zero Reply');
      callback(null,[]);
    },
    
    'system.multicall': function systemmulticall(err, params, callback) {
      that.log.debug('rpc <- system.multicall Zero Reply');
      
      
      params.map(function(events) {
        try {
          events.map(function(event) {
            if ((event["methodName"] == "event") && (event["params"] !== undefined)) {
              var params = event["params"];
              var channel = that.interface + params[1];
              var datapoint = params[2];
              var value = params[3];
          	  that.log.debug("RPC event for %s %s with value %s",channel,datapoint,value);
          	  that.ccuEvent(channel,datapoint,value);
          	  
            }
          });
        } catch (err) {}
      });
      callback(null,[]);
    } 
	
	};
    
    
    Object.keys(that.methods).forEach(function (m) {
           that.server.on(m, that.methods[m]);
    });
    
    // Publish Server to CCU
    var ccuIP =  this.hm_layer.ccuIP;
    
    this.client = xmlrpc.createClient({
      host: ccuIP,
      port: 2001,
      path: "/"
    });
    
    this.log.debug("CCU RPC Init Call for interface BidCos-RF");
    this.client.methodCall("init", ["http://" + localIP + ":" + port , "hvl_BidCos" ], function(error, value) {
      that.log.debug("CCU Response ...Value (%s) Error : (%s)",JSON.stringify(value) , error);
    });

	this.calculateSunTimes();
	this.reInitScripts();
    
    scheduler.scheduleJob('0 0 * * *', function () {
    // re-calculate every day
    this.calculateSunTimes();
    // schedule events for this day
    this.sunEvents.forEach(function (event) {
        that.sunScheduleEvent(event);
    });
    this.log.info('re-scheduled', this.sunEvents.length, 'sun events');
});

}

LogicalBridge.prototype.reInitScripts = function() {
	// Kill all and Init 
	this.scripts = {};
    this.subscriptions = [];
    var path = this.configuration.storagePath();
    this.loadScriptDir(path + "/scripts/");
}

LogicalBridge.prototype.loadScriptDir = function(pathName) {
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


LogicalBridge.prototype.loadScript = function(filename) {
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
                that.scripts[filename] = that.createScript(src, filename);
            }
            if (that.scripts[filename]) {
                that.runScript(that.scripts[filename], filename);
            }
	    }
	});    
}

LogicalBridge.prototype.createScript = function(source, name) {

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
        log.error(name, e.name + ':', e.message);
        return false;
    }
}


LogicalBridge.prototype.sendValueRPC = function(adress,datapoint,value) {
	this.client.methodCall("setValue", {"params":[adress,datapoint,value]}, function(error, value) {});
}

LogicalBridge.prototype.getValueRPC = function(adress,datapoint,callback) {
	this.client.methodCall("getValue", {"params":[adress,datapoint]}, function(error, value) {
		
	});
}

LogicalBridge.prototype.ccuEvent = function(adress,datapoint,value) {
  this.processSubscriptions(adress,datapoint,value);
}


LogicalBridge.prototype.processSubscriptions = function(adress,datapoint,value) {
  var that = this;

  this.subscriptions.forEach(function (subs) {
	  
	  
	  var options = subs.options || {};
      var delay;
      var match;
	  var eventSource = adress+"."+datapoint;

	  
	  if (typeof subs.source === 'string') {
            match = (subs.source == eventSource);
        } else if (subs.source instanceof RegExp) {
            match = eventSource.match(subs.source);
        }

      if (typeof subs.callback === 'function' && match) {
      
            if (options.change && (state.val === oldState.val)) return;

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

LogicalBridge.prototype.calculateSunTimes = function() {
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


LogicalBridge.prototype.sunScheduleEvent = function(obj, shift) {
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




LogicalBridge.prototype.runScript = function(script, name) {

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
                args.unshift(name + ':');
                that.log.debug.apply(that.log, args);
            },
            /**
             * Log an info message
             * @memberof log
             * @method info
             * @param {...*}
             */
            info: function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(name + ':');
                that.log.info.apply(that.log, args);
            },
            /**
             * Log a warning message
             * @memberof log
             * @method warn
             * @param {...*}
             */
            warn: function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(name + ':');
                that.log.warn.apply(that.log, args);
            },
            /**
             * Log an error message
             * @memberof log
             * @method error
             * @param {...*}
             */
            error: function () {
                var args = Array.prototype.slice.call(arguments);
                args.unshift(name + ':');
                that.log.error.apply(that.log, args);
            }
        },
        
        link: function Sandbox_link(source, target, /* optional */ value) {
            Sandbox.subscribe(source, function (source, val) {
                val = (typeof value === 'undefined') ? val : value;
                that.log.debug('link', source, target, val);
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
                
                that.subscriptions.push({source: source, options: options, callback: (typeof callback === 'function') && scriptDomain.bind(callback)});

            } else if (typeof source === 'object' && source.length) {

                source = Array.prototype.slice.call(source);
                source.forEach(function (tp) {
                    Sandbox.subscribe(tp, options, callback);
                });

            }

        },
        
        setValue:   function Sandbox_setValue(target, val) {

            if (typeof target === 'object' && target.length) {
                target = Array.prototype.slice.call(target);
                target.forEach(function (tp) {
                    Sandbox.setValue(tp, val);
                });
                return;
            }

			var tmp = target.split('.');
			// First Part should be the interface
			// Second the Adress
			// third the Datapoint
			if (tmp.length>2) {
				
				if (tmp[0].toLowerCase()=="bidcos-rf") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					that.sendValueRPC (adress,datapointName,val);  
				}

				if (tmp[0].toLowerCase()=="hmvirtual") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					var channel = that.hm_layer.channelWithAdress(adress);
					if (channel) {
						channel.setValue(datapointName,val);
						channel.updateValue(datapointName,val,true);
					}
				}
				
				
			} else {
				that.log.error("Target %s seems not to be value",target);
			}
			
		},
		
		getValue:   function Sandbox_getValue(target,callback) {

   			var tmp = target.split('.');
   			if (typeof callback === 'function') {
			// First Part should be the interface
			// Second the Adress
			// third the Datapoint
			if (tmp.length>2) {
				
				if (tmp[0].toLowerCase()=="bidcos-rf") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					that.getValueRPC (adress,datapointName,function(newValue) {
						
						callback(newValue);
						
					});  
				}

				if (tmp[0].toLowerCase()=="hmvirtual") {
					var adress = tmp[1];
					var datapointName = tmp[2];
					var channel = that.hm_layer.channelWithAdress(adress);
					if (channel) {
						callback(channel.getValue(datapointName));
					}
				}
				
				
			} else {
				that.log.error("Target %s seems not to be value",target);
				callback(undefined);
			}
			
		  }
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

            if (options.random) {
                scheduler.scheduleJob(pattern, function () {
                    setTimeout(scriptDomain.bind(callback), (parseFloat(options.random) || 0) * 1000 * Math.random());
                });
            } else {
                scheduler.scheduleJob(pattern, scriptDomain.bind(callback));
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

LogicalBridge.prototype.processLogicalBinding = function(source_adress) {
  var channel = this.hm_layer.channelWithAdress(source_adress);
  var that = this;
  that.log.debug("uhh someone is intrested in my value changes");
  if (channel) {
	  
  channel.on('event_channel_value_change', function(parameter){
	  parameter.parameters.forEach(function (pp){
		  that.processSubscriptions("HMVirtual."+parameter.channel,pp.name,pp.value);
	  });
  });
  }
}






LogicalBridge.prototype.getValue = function(adress) {
   return this.elements[adress];
}

LogicalBridge.prototype.shutdown = function() {

	
}

LogicalBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
		
		  case "reload": {
			  this.reInitScripts();
		  }
		  break;
		}
	}
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",undefined);
}


module.exports = {
  LogicalBridge : LogicalBridge
}
