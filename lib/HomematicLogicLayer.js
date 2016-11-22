//
//  HomematicLogicalLayer.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var xmlrpc = require(__dirname + "/homematic-xmlrpc");
var request = require("request");
var Logger = require(__dirname + '/Log.js').Logger;
var logger = new Logger("HomematicLogicalLayer");
var Url = require("url");
var fs = require('fs');
var HomematicChannel = require(__dirname + "/HomematicChannel.js").HomematicChannel;
var HomematicDevice = require(__dirname + "/HomematicDevice.js").HomematicDevice;


var RPCConsumer = function() {

}

RPCConsumer.prototype.methodCall = function (method, params, callback) {
	var that = this;
	this.client.methodCall(method , params, function(error, value) {
		callback(error,value)
	});
}

RPCConsumer.prototype.encode = function() {
	return {"hostname":this.hostname,"port":this.port,"path":this.path,"callbackid":this.callbackid};
}

RPCConsumer.prototype.initwithurl = function(ccuip,urlstring,callbackid) {

 // replace xmlrpc_bin 
 
  urlstring = urlstring.replace("xmlrpc_bin", "http");
  urlstring = urlstring.replace("xmlrpc", "http");
 
  var purl = Url.parse(urlstring);
  this.port = purl.port; 
  this.path = purl.pathname;
  this.callbackid = callbackid;
  this.hostname = "";
  
  switch (purl.hostname) {
	  
	  case "127.0.0.1":
	  this.hostname = ccuip;
	  break;
	  case undefined:
	  this.hostname = ccuip;
	  break;
	  default:
	  this.hostname = purl.hostname;
  }
  
  
  this.client = xmlrpc.createClient({
			host: this.hostname,
			port: this.port,
			path: this.path
  });
}

RPCConsumer.prototype.initwithcoder = function(encodedobject,ccuip) {


  this.port = encodedobject.port; 
  this.path = encodedobject.path;
  this.callbackid = encodedobject.callbackid;
  
  if (encodedobject.hostname == undefined) {
	  encodedobject.hostname = "127.0.0.1";
  }
  
  if (encodedobject.hostname == "127.0.0.1") {
	  this.hostname = ccuip;
  } else {
	  this.hostname = encodedobject.hostname;
  }

	this.client = xmlrpc.createClient({
			host: this.hostname,
			port: this.port,
			path: this.path
  	});

}

RPCConsumer.prototype.description = function() {
  return this.hostname + ":" + this.port + this.path;
}

RPCConsumer.prototype.isEqual = function(rpcconsumer) {

  var result = true;
  
  if (this.port != rpcconsumer.port) {
	  result = false;}
  if (this.hostname != rpcconsumer.hostname) {
	  result = false;}
  if (this.path != rpcconsumer.path) {
	  result = false;}
  return result;  
}


var HomematicLogicalLayer = function (config) {
	this.rpc_server;
	this.clients = [];
	this.devices = [];
	this.rpcClient;
	this.interfaceID;
	this.interfaceCallbackId;
	this.config = config;
	this.consumer = [];
	
	this.ccuIP = this.config.getValue("ccu_ip");
	if (this.ccuIP == undefined) {
		logger.error("please setup your ccu ip in config.json");
	} else {
	    logger.info("welcome. will create a logical layer for CCU at " + this.ccuIP);
		this.loadConsumer(this.ccuIP);
	}
}

HomematicLogicalLayer.prototype.init = function() {
    var that = this;
	var localPort = 7000;

	var ip = this.getIPAddress();
	if (ip == "0.0.0.0") {
      logger.error("Cannot fetch my own ip");
	}

    logger.info("MyIP is " + ip);

	this.rpc_server = xmlrpc.createServer({
      host: ip,
      port: localPort
	});

	this.rpc_server.on("NotFound", function(method, params) {
      logger.debug("Method " + method + " does not exist. - " + JSON.stringify(params));
	});

	logger.debug("XML-RPC server for interface Homematic Virtual Interface is listening on port " + localPort);


 	this.methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
	   	    logger.debug('rpc < system.listMethods', err, params);
            logger.debug('repl  >', null, JSON.stringify(Object.keys(that.methods)));
            callback(null,Object.keys(that.methods));
    },
    
    'listDevices': function listDevices(err, params, callback) {
       		logger.debug('rpc < listDevices', err, params);
       		var devices = that.getMyDevices();
       		logger.debug("RPC listDevices Response %s Errors: %s",JSON.stringify(devices),err);
            callback(null, devices);
    },
    
    'getDeviceDescription': function getDeviceDescription(err, params, callback) {
    
		    logger.debug('rpc < getDeviceDescription', err, params);
    		var adress = params[0];
			var found = false;
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getDeviceDescription()
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    found = true;
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getChannelDescription();
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    found = true;
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	      });
	    	 
	    if (found == false) {
	    	logger.debug('repl > getDeviceDescription', "Nothing Found");

			callback("Adress Not found",undefined);
		}
    },
    
    
    'getLinks': function getLinks(err, params, callback) {
    
		    logger.debug('rpc < getLinks', err, params);
		    logger.debug('repl  >', null, null);
    		callback(null,[]);
     },
    
    
    'getValue': function getValue(err, params, callback) {
    		logger.debug('rpc < getValue', err, params);
		    var adress = params[0];
			var parameterName = params[1];
			that.devices.forEach(function (device) {
	    	  	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getValue(parameterName);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});

     },
    
    'setValue': function setValue(err, params, callback) {
    		logger.debug('rpc < setValue', err, params);
		    var adress = params[0];
			var parameterName = params[1];
			var value = params[2];
			that.devices.forEach(function (device) {
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    	channel.setValue(parameterName,value);
	    	   		logger.debug('repl  >', null, null);
	    	   		callback(null,undefined);
	    	    return;
	    	  }
	   	     });
	    	  
	    	});

     },
    

    
    'getParamsetDescription': function getParamsetDescription(err, params, callback) {
			logger.debug('rpc < getParamsetDescription', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamsetDescription(paramset)
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamsetDescription(paramset);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},

    'getParamsetId': function getParamsetId(err, params, callback) {
			logger.debug('rpc < getParamsetId', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamsetId(paramset)
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamsetId(paramset);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},

   'getParamset': function getParamset(err, params, callback) {
			logger.debug('rpc < getParamset', err, params);
			var adress = params[0];
			var paramset = params[1];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.getParamset(paramset)
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamset(paramset);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
	    	

	},



	'reportValueUsage': function reportValueUsage(err, params, callback) {
			logger.debug('rpc < reportValueUsage', err, params);
			// thank you for the fish ...
			callback(null,[]);
	},


	'deleteDevice': function deleteDevice(err, params, callback) {
			logger.debug('rpc < deleteDevice', err, params);
			var adress = params[0];
			var mode = params[1];
			logger.debug('repl  >', null);
			callback(null,[]);
			
			// call Bridge and set Flag
			
			// rega callback
			that.consumer.forEach(function(consumer){
				that.sendRPCMessage(consumer.callbackid,"deleteDevices",[adress], function(error, value) {});
			});
			/*
			if (that.rpcClient!=undefined) {
	            that.rpcClient.methodCall("deleteDevices", [that.callInterfaceBackId,[adress]] , function(error, value) {
    				logger.debug("RPC deleteDevices Response %s Errors: %s",JSON.stringify(that.sendMyDevices()),error);
    			});
            }
            */
            
	},


	'getLinkPeers': function getLinkPeers(err, params, callback) {
			logger.debug('rpc < getLinkPeers', err, params);
			var adress = params[0];
			var mode = params[1];
			logger.debug('repl  >', null);
			callback(null,[]);
	},




    'putParamset': function putParamset(err, params, callback) {
			logger.debug('rpc < putParamset', err, params);
			var adress = params[0];
			var paramset = params[1];
			var parameters = params[2];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.putParamset(paramset,parameters)
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.putParamset(paramset,parameters);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});
			callback(null,[]);
	},

	
    'init' : function init(err, params, callback) {
            logger.debug('rpc < init', err, params);
            var intf = params[1];
 			var cns = new RPCConsumer();
 			
 			if (intf != "") {
 				cns.initwithurl(that.ccuIP,params[0],params[1]);
				that.addConsumer(cns);
				that.saveConsumer();
				that.sendRPCMessage(params[1],"newDevices",that.getMyDevices(), function(error, value) {});
				logger.info("connection request from your ccu .. live is good");
 			} else {
 				that.removeOldConsumer(cns);
 				that.saveConsumer();
				logger.info("there is a removal");
			}
	}
	
	};


    Object.keys(that.methods).forEach(function (m) {
           that.rpc_server.on(m, that.methods[m]);
    });
    
	this.rpc_server.close = function() {
		logger.info("RPC Server was removed.");
    };
}

HomematicLogicalLayer.prototype.addConsumer = function(aConsumer) {
  // TODO Check if we have to purge old Consumers
  logger.debug("Adding new Consumer");
  this.consumer = this.removeOldConsumer(aConsumer);
  this.consumer.push(aConsumer);
}

HomematicLogicalLayer.prototype.saveConsumer = function() {
  // Encode
  var encoded = [];
  this.consumer.map(function(consumer){
	  encoded.push(consumer.encode());
  });
  this.config.setValue("consumer",JSON.stringify(encoded));
}

HomematicLogicalLayer.prototype.consumerWithID = function(cid) {

  this.consumer.forEach(function(aConsumer){
	  if (aConsumer.callbackid == cid) {
		  return aConsumer;
	  }
  });
  
  return undefined;
}


HomematicLogicalLayer.prototype.removeOldConsumer = function(newconsumer) {
  var result =  this.consumer.filter(function(ctt) { return !ctt.isEqual(newconsumer); });
  return result;
}

HomematicLogicalLayer.prototype.loadConsumer = function(ccuip) {
  var that = this;
  this.consumer = [];
  var myccuip = ccuip;
  
  var consumer = this.config.getValue("consumer");
  try {
	  
  var oconsumer = JSON.parse(consumer);
  
  if (oconsumer != undefined) {
	  
	  oconsumer.map(function(obj) {
		    var cns = new RPCConsumer();
 			cns.initwithcoder(obj,myccuip);
 			that.addConsumer(cns);
	  });
  }
  
  } catch (e){}
}

HomematicLogicalLayer.prototype.shutdown = function() {
	logger.debug("Configuration Server Shutdown");
	this.rpc_server.close();
}


HomematicLogicalLayer.prototype.sendRPCEvent = function(adress,parameters) {
   var that = this;
   
   this.consumer.forEach(function (tc){
		var eventPayload = [];
		var cid = tc.callbackid;
		 parameters.forEach(function (parameter) {
	     	if (parameter.type=="FLOAT") {
		 		eventPayload.push({"methodName":"event","params":[cid ,adress,parameter.name,{"explicitDouble":parameter.value}]})
		 	} else {
		 		eventPayload.push({"methodName":"event","params":[cid ,adress,parameter.name,parameter.value]})
		 	}
		 	tc.methodCall("system.multicall", [eventPayload] , function(error, value) {});
     });
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

HomematicLogicalLayer.prototype.sendRPCMessage = function(consumerID, method,payload,callback) {
  
  if (consumerID == undefined) {
	  // send to all
	this.consumer.forEach( function(aConsumer){
		
	    aConsumer.methodCall(method, [consumerID,payload] , function(error, value) {
    				logger.debug("RPC %s Response %s Errors: %s",method,JSON.stringify(payload),error);
    				if (callback!=undefined) {
    				  callback(error,value);
    				}
    	});
	});
  } else {
    var consumer = this.consumerWithID(consumerID);
    if (consumer != undefined) {
	    consumer.methodCall(method, [consumerID,payload] , function(error, value) {
    				logger.debug("RPC %s Response %s Errors: %s",method,JSON.stringify(payload),error);
    				if (callback!=undefined) {
    				  callback(error,value);
    				}
    	});
    }
 }
}

HomematicLogicalLayer.prototype.addDevice = function(device) {
   logger.debug("Add new Device to HomematicLogicLayer " + device.adress);
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

HomematicLogicalLayer.prototype.listConsumer = function() {
 return this.consumer;
}

module.exports = {
  HomematicLogicalLayer : HomematicLogicalLayer
}
