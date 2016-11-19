"use strict";

var xmlrpc = require(__dirname + "/homematic-xmlrpc");
var request = require("request");
var debug = require('debug')('HomematicLogicalLayer');
var fs = require('fs');
var Channel = require(__dirname + "/Channel.js").Channel;
var Device = require(__dirname + "/Device.js").Device;

const chalk = require('chalk');
const log = console.log;


var HomematicLogicalLayer = function (config) {
	this.server;
	this.clients = [];
	this.devices = [];
	this.rpcClient;
	this.interfaceID;
	this.interfaceCallbackId;
	this.config = config;
	
	this.ccuIP = this.config.getValue("ccu_ip");
	if (this.ccuIP == undefined) {
		log(chalk.red("please setup your ccu ip in config.json"));
	} else {
	    log(chalk.gray("welcome. will create a logical layer for CCU at " + this.ccuIP));
	}

}

HomematicLogicalLayer.prototype.init = function() {
    var that = this;
	var localPort = 7000;

	var ip = this.getIPAddress();
	if (ip == "0.0.0.0") {
      log(chalk.red("Cannot fetch my own ip"));
	}

    log(chalk.gray("MyIP is " + ip));

	this.server = xmlrpc.createServer({
      host: ip,
      port: localPort
	});

	this.server.on("NotFound", function(method, params) {
      debug("Method " + method + " does not exist. - " + JSON.stringify(params));
	});

	log(chalk.gray("XML-RPC server for interface HmHue is listening on port " + localPort));


 	this.methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
            debug('rpc < system.listMethods', err, params);
            debug('repl  >', null, JSON.stringify(Object.keys(that.methods)));
            callback(null,Object.keys(that.methods));
    },
    
    'listDevices': function listDevices(err, params, callback) {
       		debug('rpc < listDevices', err, params);
       		var devices = that.getMyDevices();
       		debug("RPC listDevices Response %s Errors: %s",JSON.stringify(devices),err);
            callback(null, devices);
    },
    
    'getDeviceDescription': function getDeviceDescription(err, params, callback) {
    
		    debug('rpc < getDeviceDescription', err, params);
    		var adress = params[0];
			var found = false;
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getDeviceDescription()
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    found = true;
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getChannelDescription();
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    found = true;
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	      });
	    	 
	    if (found == false) {
	    	debug('repl > getDeviceDescription', "Nothing Found");

			callback("Adress Not found",undefined);
		}
    },
    
    
    'getLinks': function getLinks(err, params, callback) {
    
		    debug('rpc < getLinks', err, params);
		    debug('repl  >', null, null);
    		callback(null,[]);
     },
    
    
    'getValue': function getValue(err, params, callback) {
    		debug('rpc < getValue', err, params);
		    var adress = params[0];
			var parameterName = params[1];
			that.devices.forEach(function (device) {
	    	  	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getValue(parameterName);
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});

     },
    
    'setValue': function setValue(err, params, callback) {
    		debug('rpc < setValue', err, params);
		    var adress = params[0];
			var parameterName = params[1];
			var value = params[2];
			that.devices.forEach(function (device) {
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    	channel.setValue(parameterName,value);
	    	   		debug('repl  >', null, null);
	    	   		callback(null,undefined);
	    	    return;
	    	  }
	   	     });
	    	  
	    	});

     },
    

    
    'getParamsetDescription': function getParamsetDescription(err, params, callback) {
			debug('rpc < getParamsetDescription', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamsetDescription(paramset)
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamsetDescription(paramset);
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},

    'getParamsetId': function getParamsetId(err, params, callback) {
			debug('rpc < getParamsetId', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamsetId(paramset)
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamsetId(paramset);
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},

   'getParamset': function getParamset(err, params, callback) {
			debug('rpc < getParamset', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamset(paramset)
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamset(paramset);
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},



	'reportValueUsage': function reportValueUsage(err, params, callback) {
			debug('rpc < reportValueUsage', err, params);
			// thank you for the fish ...
			callback(null,[]);
	},


	'deleteDevice': function deleteDevice(err, params, callback) {
			debug('rpc < deleteDevice', err, params);
			var adress = params[0];
			var mode = params[1];
			debug('repl  >', null);
			callback(null,[]);
			
			// call Bridge and set Flag
			
			// rega callback
			
			that.sendRPCMessage("deleteDevices",[adress], function(error, value) {});
			/*
			if (that.rpcClient!=undefined) {
	            that.rpcClient.methodCall("deleteDevices", [that.callInterfaceBackId,[adress]] , function(error, value) {
    				debug("RPC deleteDevices Response %s Errors: %s",JSON.stringify(that.sendMyDevices()),error);
    			});
            }
            */
            
	},


	'getLinkPeers': function getLinkPeers(err, params, callback) {
			debug('rpc < getLinkPeers', err, params);
			var adress = params[0];
			var mode = params[1];
			debug('repl  >', null);
			callback(null,[]);
	},




    'putParamset': function putParamset(err, params, callback) {
			debug('rpc < putParamset', err, params);
			var adress = params[0];
			var paramset = params[1];
			var parameters = params[2];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.putParamset(paramset,parameters)
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.putParamset(paramset,parameters);
	    	    debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
			callback(null,[]);
	},

	
    'init' : function init(err, params, callback) {
            debug('rpc < init', err, params);
            var intf = params[1];
            if (intf != "HmHue_java") {
            that.createRPCClient();
            callback(null, []);
            that.interfaceCallbackId = intf;
            that.config.setValue("interface_id",intf);
            that.sendRPCMessage("newDevices",that.getMyDevices(), function(error, value) {});
            log(chalk.green("connection request from your ccu .. live is good"));
			}
    }

    
    };


    Object.keys(that.methods).forEach(function (m) {
           that.server.on(m, that.methods[m]);
    });
    
	// try to init a rpc client depending on the latest InterfaceIC
	var lastInterfaceID = this.config.getValue("interface_id");
	if (lastInterfaceID != undefined) {
		this.interfaceCallbackId = lastInterfaceID;
		this.createRPCClient();
	}
}

HomematicLogicalLayer.prototype.sendRPCEvent = function(adress,parameters) {
   var that = this;
   var eventPayload = [];
   
   parameters.forEach(function (parameter) {
   
      if (parameter.type=="FLOAT") {
          eventPayload.push({"methodName":"event","params":[that.interfaceCallbackId,adress,parameter.name,{"explicitDouble":parameter.value}]})
	  } else {
	      eventPayload.push({"methodName":"event","params":[that.interfaceCallbackId,adress,parameter.name,parameter.value]})
      }
   
   })
   

   if (that.rpcClient!=undefined) {
   that.rpcClient.methodCall("system.multicall", [eventPayload] , function(error, value) {
    				debug("RPC system.multicall Response %s Errors: %s",JSON.stringify(eventPayload),error);
   });
  }
}


HomematicLogicalLayer.prototype.createRPCClient = function() {
	this.rpcClient = xmlrpc.createClient({
      host: this.ccuIP,
      port: 1999,
      path: "/"
    });
}

HomematicLogicalLayer.prototype.getMyDevices = function() {
      var result = [];
      
      this.devices.forEach(function (device) {
	    result.push(device.getDeviceDescription())
	    
	    device.channels.forEach(function (channel) {
	     result.push(channel.getChannelDescription())
	    });
	    
	  });
     return result; 
}

HomematicLogicalLayer.prototype.sendRPCMessage = function(method,payload,callback) {
  if (this.rpcClient!=undefined) {
	 this.rpcClient.methodCall(method, [this.interfaceCallbackId,payload] , function(error, value) {
    				debug("RPC %s Response %s Errors: %s",method,JSON.stringify(payload),error);
    				if (callback!=undefined) {
    				  callback(error,value);
    				}
    });
  }
}

HomematicLogicalLayer.prototype.addDevice = function(device) {
   debug("Add new Device to HM Layer");
   this.devices.push(device);
   var that = this;
   // Add Listener to Working Events to publish
   device.on("event_device_channel_value_change", function(parameter){
     that.sendRPCEvent(parameter.channel,parameter.parameters);
   });
   
}

HomematicLogicalLayer.prototype.getIPAddress = function() {
    var interfaces = require("os").networkInterfaces();
    for (var devName in interfaces) {
      var iface = interfaces[devName];
      for (var i = 0; i < iface.length; i++) {
        var alias = iface[i];
        if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal)
          return alias.address;
      }
    }
    return "0.0.0.0";
}

module.exports = {
  HomematicLogicalLayer : HomematicLogicalLayer
}
