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
var logger = require(__dirname + "/logger.js").logger("HomematicLogicalLayer");
var Url = require("url");
var fs = require('fs');
var HomematicChannel = require(__dirname + "/HomematicChannel.js").HomematicChannel;
var HomematicDevice = require(__dirname + "/HomematicDevice.js").HomematicDevice;


var RPCConsumer = function() {

}

RPCConsumer.prototype.methodCall = function (method, params, callback) {
	var that = this;
	logger.debug("RPC Out -> %s %s",method,JSON.stringify(params));
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
	this.homematicChannel = HomematicChannel;
	this.homematicDevice = HomematicDevice;
	this.lastMessage = "";

	this.ccuIP = this.config.getValue("ccu_ip");
	if (this.ccuIP == undefined) {
		logger.error("please setup your ccu ip in config.json");
	} else {
	    logger.info("welcome. will create a interface layer for CCU at " + this.ccuIP);
		this.loadConsumer(this.ccuIP);
	}
}

HomematicLogicalLayer.prototype.init = function() {
    var that = this;
	var localPort = 7000;
    var localip = this.config.getValue("local_ip");
    var ip;

    if (localip == undefined) {
		 ip = this.getIPAddress();
    } else {
	    ip = localip;
    }

	if (ip == "0.0.0.0") {
      logger.error("Cannot fetch my own ip");
	}

    logger.info("MyIP is " + ip);

	try {
		
	this.rpc_server = xmlrpc.createServer({
      host: ip,
      port: localPort
	});

	} catch (e) {
		logger.error ("Cant start rpc");
	}


	this.rpc_server.on("NotFound", function(method, params) {
      logger.debug("Method " + method + " does not exist. - " + JSON.stringify(params));
	});

	logger.debug("XML-RPC server for interface Homematic Virtual Interface is listening on port " + localPort);


 	this.methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
	   		that.lastMessage = new Date();
	   	    logger.debug('rpc < system.listMethods', null, params);
            logger.debug('repl  >', null, JSON.stringify(Object.keys(that.methods)));
            callback(null,Object.keys(that.methods));
    },
    
    'listDevices': function listDevices(err, params, callback) {
	    	
	   		that.lastMessage = new Date();
       		logger.debug('rpc < listDevices', null, params);
       		
       		if (err.headers["user-agent"]=="Apache-HttpClient/4.2.5 (java 1.5)") {
	       	 logger.debug("Hide Devices from HMServer")
	       	callback(null, []);
            	
       		} else {
	       		
       		
       		var devices = that.getMyDevices();
            callback(null, devices);}
            
    },
    
    'getDeviceDescription': function getDeviceDescription(err, params, callback) {
    
	   		that.lastMessage = new Date();
		    logger.debug('rpc < getDeviceDescription', null, params);
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
			callback({"faultCode":-2,"faultString":"Unknown instance"},undefined);
		}
    },
    
    
    'getLinks': function getLinks(err, params, callback) {
    
	   		that.lastMessage = new Date();
		    logger.debug('rpc < getLinks', null, params);
		    logger.debug('repl  >', null, []);
    		callback(null,[]);
     },
    
    
    'getValue': function getValue(err, params, callback) {
	   		that.lastMessage = new Date();
    		logger.debug('rpc < getValue', null, params);
		    var adress = params[0];
			var parameterName = params[1];
			that.devices.forEach(function (device) {
	    	  	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.getParamsetValue("VALUES",parameterName);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });
	    	  
	    	});

     },
    
    'setValue': function setValue(err, params, callback) {
	   		that.lastMessage = new Date();
    		logger.debug('rpc < setValue', null, params);
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
	   		that.lastMessage = new Date();
			logger.debug('rpc < getParamsetDescription', null, params);
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
	   		that.lastMessage = new Date();
			logger.debug('rpc < getParamsetId', null, params);
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
	   		that.lastMessage = new Date();
			logger.debug('rpc < getParamset', null, params);
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
	   		that.lastMessage = new Date();
			logger.debug('rpc < reportValueUsage', null, params);
			// thank you for the fish ...
			callback(null,[]);
	},


	'deleteDevice': function deleteDevice(err, params, callback) {
	   		that.lastMessage = new Date();
			logger.debug('rpc < deleteDevice', null, params);
			var adress = params[0];
			var mode = params[1];
			logger.debug('repl  >', []);
			callback(null,[]);
			
			// call Bridge and set Flag
			var device = that.deviceWithAdress(adress);
			if (device != undefined) {
				that.deleteDevice(device,false);
			}
			// rega callback
			that.sendRPCMessage(undefined,"deleteDevices",[adress], function(error, value) {});
	},


	'getLinkPeers': function getLinkPeers(err, params, callback) {
	   		that.lastMessage = new Date();
			logger.debug('rpc < getLinkPeers', null, params);
			var adress = params[0];
			var mode = params[1];
			logger.debug('repl  >', null);
			callback(null,[]);
	},

	'system.methodHelp' : function methodHelp(err,params,callback) {
	   		that.lastMessage = new Date();
			logger.debug('rpc < methodHelp', err, params);
			logger.debug('repl  >', null);
			callback(null,[]);
	},


    'putParamset': function putParamset(err, params, callback) {
	   		that.lastMessage = new Date();
			logger.debug('rpc < putParamset', null, params);
			var adress = params[0];
			var paramset = params[1];
			var parameters = params[2];
			that.devices.forEach(function (device) {
	    	  if (device.adress == adress) {
	    	    var re = device.putParamset(paramset,parameters)
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    device.resetConfigPending();
				that.saveDevice(device);
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress == adress) {
	    	    var re = channel.putParamset(paramset,parameters);
	    	    logger.debug('repl  >', null, JSON.stringify(re));
	    	    device.resetConfigPending();
				that.saveDevice(device);
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     });


	    	});
			callback(null,[]);
	},

	
    'init' : function init(err, params, callback) {
	   		that.lastMessage = new Date();
            logger.debug('rpc < init', null, params);
            var intf = params[1];
 			var cns = new RPCConsumer();
 			
 			if (intf != "") {
	 			if (that.isHMServer(intf)==false) {
 				cns.initwithurl(that.ccuIP,params[0],params[1]);
				that.addConsumer(cns);
				that.saveConsumer();
				logger.info("connection request from your ccu .. live is good");
				} else {
					logger.debug("Ignore HMServer because the front fell off");
				}
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

HomematicLogicalLayer.prototype.isHMServer = function(intf) {
	//return false;
	
	return intf.indexOf("_java", intf.length - "_java".length) !== -1;
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
  this.config.setPersistValue("consumer",JSON.stringify(encoded));
}

HomematicLogicalLayer.prototype.consumerWithID = function(cid) {

  this.consumer.forEach(function(aConsumer){
	  if (aConsumer.callbackid == cid) {
		  return aConsumer;
	  }
  });
  
  return undefined;
}


HomematicLogicalLayer.prototype.cleanUp = function() {
	this.consumer = [];	
	this.saveConsumer();
	this.lastMessage = "";
}

HomematicLogicalLayer.prototype.removeOldConsumer = function(newconsumer) {
  var result =  this.consumer.filter(function(ctt) { return !ctt.isEqual(newconsumer); });
  return result;
}

HomematicLogicalLayer.prototype.loadConsumer = function(ccuip) {
  var that = this;
  this.consumer = [];
  var myccuip = ccuip;
  
  var consumer = this.config.getPersistValue("consumer");
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
	this.rpc_server.close();
	logger.debug("Virtual Layer Shutdown");
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
		 	tc.methodCall("system.multicall", [eventPayload] , function(error, value) {
			 
		 	});
     });
   });
}

HomematicLogicalLayer.prototype.getMyDevices = function() {
      var result = [];
      var that = this;
      this.devices.some(function (device) {
	    // Check if there is a deletion flag
	    if (!that.wasDeletedBefore(device)) {
	    	if (device.hidden == false) {
		    	result.push(device.getDeviceDescription())
				device.channels.forEach(function (channel) {
					result.push(channel.getChannelDescription())
				});	
	    	}
	    }
	  });
     return result; 
}


HomematicLogicalLayer.prototype.publishAllDevices = function(callback) {
	var that = this;
	this.sendRPCMessage(undefined,"newDevices",this.getMyDevices(), function(error, value) {
		that.devices.forEach(function (device) {
			if (device.hidden == false) {
				device.wasPublished = true;
				that.saveDevice(device);
			}
		});
		callback();
	});
}

HomematicLogicalLayer.prototype.sendRPCMessage = function(consumerID, method,payload,callback) {
  
  if (consumerID == undefined) {
	  // send to all
    logger.debug("Will send to all Consumers");
	this.consumer.forEach( function(aConsumer){
	    aConsumer.methodCall(method, [aConsumer.callbackid,payload] , function(error, value) {
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

HomematicLogicalLayer.prototype.addDevice = function(device,save,hidden) {
   logger.debug("Add new Device to HomematicLogicLayer " + device.adress);
   device.hidden = hidden || false;
   this.devices.push(device);
   logger.debug("Pushed to list %s",device.hidden);
   var that = this;
   
   if (!hidden) {
   	// Add Listener to Working Events to publish
   		device.on("event_device_channel_value_change", function(parameter){
		 logger.debug("Device Value Change Event for %s",parameter.channel);
		 that.sendRPCEvent(parameter.channel,parameter.parameters);
		});
   }
   
  
   
   if ((!device.wasPublished) && (!device.hidden)) {
   		logger.debug("Send this to CCU");
   		var result = [];
   		result.push(device.getDeviceDescription())
	    
   		device.channels.forEach(function (channel) {
	    	 result.push(channel.getChannelDescription())
  		});
   
  		this.sendRPCMessage(undefined,"newDevices",result, function(error, value) {
	  		device.wasPublished = true;
	  		if (save) {that.saveDevice(device);}
    	});
    	
   } else {
	  logger.debug("CCU should (not) know about %s",device.adress);
      if (save) {this.saveDevice(device);}
   }
   
}

HomematicLogicalLayer.prototype.deviceDataWithSerial = function(serial) {
  var persistenceFile = this.config.storagePath() + "/" + serial + ".dev";
  try {
    var data = fs.readFileSync(persistenceFile);
    // Try to parse //
	    JSON.parse(data);
    return data;
  } catch (e) {
    return undefined;
  }
}

HomematicLogicalLayer.prototype.wasDeletedBefore = function(device) {
	var result = false
	var deletedDevices = this.config.getPersistValueWithDefault("deletedDevices",[]);
	if (deletedDevices) {
		deletedDevices.some(function (adress){
			if (device.adress===adress) {
				result = true;
			}
		})
	}
	
	return result
}


HomematicLogicalLayer.prototype.saveDevice = function(device) {
   var persistenceFile = this.config.storagePath() + "/" + device.serialNumber + ".dev";
   logger.debug("make device %s persistent at %s",device.serialNumber,persistenceFile);
   fs.writeFile(persistenceFile, device.savePersistent(), function(err) {});
}

HomematicLogicalLayer.prototype.removeStoredDeviceData = function(device) {
   var persistenceFile = this.config.storagePath() + "/" + device.serialNumber + ".dev";
   try {
     fs.unlinkSync(persistenceFile);
   } catch (err) {}
}


HomematicLogicalLayer.prototype.deviceWithAdress = function(adress) {
	
	var result = undefined;
	
	this.devices.forEach(function (device) {
		if (device.adress == adress) {
			result = device;
		}
		});
	return result;
}


HomematicLogicalLayer.prototype.channelWithAdress = function(adress) {
	var deviceAdress = adress.slice(0,adress.indexOf(":"));
	var selectedDevice = this.devices.filter(function (device) { return device.adress == deviceAdress}).pop();
	
	if (selectedDevice) {
		var selChannel =  selectedDevice.channels.filter(function (channel) { return channel.adress == adress}).pop();
		return selChannel;
		
	}
	return undefined;
}

HomematicLogicalLayer.prototype.devicesWithNameLike = function(name) {
	
	var result = [];
	var re = new RegExp("^"+name+"*.?");
	
	this.devices.forEach(function (device) {
		if (re.test(device.adress)) {
			result.push(device);
		}
		});
	return result;
}


HomematicLogicalLayer.prototype.deleteDevice = function(device,publish) {
   logger.debug("Remove Device from HomematicLogicLayer " + device.adress);
   var index = this.devices.indexOf(device);
   if (index > -1) {
    this.devices.splice(index, 1);
	// Remove persistence    
     var persistenceFile = this.config.storagePath() + "/" + device.serialNumber + ".dev";
     try {
	     fs.unlinkSync(persistenceFile);
		 var deltedDevices = this.config.getPersistValueWithDefault("deletedDevices",[]);
		 deltedDevices.push(device.adress);
		 this.config.setPersistValue("deletedDevices",deltedDevices);
     } catch (err) {
	     logger.error(err);
     }
     // Send that to all consumers
     if (publish == true) {
	    this.sendRPCMessage(undefined,"deleteDevices",[device.adress], function(error, value) {});
     }
     
   }
}


HomematicLogicalLayer.prototype.deleteDevicesByOwner = function(device_owner) {
  var that = this;
  this.devices.some(function (device){
	if ((device.owner) && (device.owner === device_owner)) {
	   that.deleteDeviceTemporary(device);
	}
  })
}


HomematicLogicalLayer.prototype.deleteDeviceWithAdress = function(adress) {
   logger.debug("Remove Device Rega " + adress);
   this.sendRPCMessage(undefined,"deleteDevices",[adress], function(error, value) {});
}

HomematicLogicalLayer.prototype.deleteDeviceTemporary = function(device) {
   logger.debug("temporary Remove Device from HomematicLogicLayer " + device.adress);
   var index = this.devices.indexOf(device);
   if (index > -1) {
    this.devices.splice(index, 1);
   }
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
