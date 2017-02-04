//
//  HomematicDevice.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

"use strict";

var HomematicParameterSet = require(__dirname + "/HomematicParameterSet.js").HomematicParameterSet;
var HomematicParameter = require(__dirname + "/HomematicParameter.js").HomematicParameter;
var fs = require('fs');
var path = require('path');
var HomematicChannel = require(__dirname + "/HomematicChannel.js").HomematicChannel;
var logger = require(__dirname + "/logger.js")("HomematicDevice");

const EventEmitter = require('events');
const util = require('util');

var HomematicDevice = function() {
	this.initialized = false;
	this.channels = [];
    this.paramsets = [];
	this.hiddden = false;
    EventEmitter.call(this);
}

util.inherits(HomematicDevice, EventEmitter);
	
HomematicDevice.prototype.initWithType = function(deviceType,adress) {
	logger.debug("Init With Type");
	adress = adress.replace(/[ ]/g,'_');
	var that = this;
	
    this.version = 1;
    this.firmware = "1.0";
    this.serialNumber = adress;
    
    var cfgFile = path.join(path.dirname(fs.realpathSync(__filename)), '../devices' , deviceType) + '.json';
	logger.debug("Config at "+cfgFile);
    if (fs.existsSync(cfgFile)) {
	fs.accessSync(cfgFile, fs.F_OK);
    var data = fs.readFileSync(cfgFile).toString();
	if (data != undefined) {
		logger.debug("DeviceData for " + deviceType + " found. Create new Device");
		try {
	 		var json = JSON.parse(data);
	 		if (json) {
	 		logger.debug("Device data seems to be valid");
	 		this.type = json["type"];
	 		this.adress = adress;
	 		json["channels"].forEach(function (channel) {
				var cadress = channel["adress"];
				// check this channel definition is valid for multiple adresses
				if (Array.isArray(cadress)) {
					// map each one to the same channeltype
					cadress.forEach(function(adr){
					var hm_channel = new HomematicChannel(adress,that.type,adr,
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		   			that.addChannel(hm_channel);
				  
				  
		   			});
		   			} else {
		   			// single one ... normal init
					var hm_channel = new HomematicChannel(adress,that.type,cadress,
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		   			that.addChannel(hm_channel);
		   			}
		   
			});
		logger.debug("Channels completed");
		var mps = json["paramsets"];
		mps.forEach(function (pSet) {
			var ps = new HomematicParameterSet(pSet["name"],pSet["id"]);
			var parameter = pSet["parameter"];
			if (parameter != undefined) {
				parameter.forEach(function (jParameter) {
					var p = new HomematicParameter(jParameter);
					ps.addParameter(p);
				});
     		} 
    
	 		that.paramsets.push(ps);
    	});
    	logger.debug("Parameter completed");
    
		this.version = json["version"];
		
		 // set LOWBAT to false
		 var mt = this.getChannelWithTypeAndIndex("MAINTENANCE",0);
		 if (mt) {
			 mt.setValue("LOWBAT",false);
		 	mt.setValue("CONFIG_PENDING",false);
		 	mt.setValue("STICKY_UNREACH",false);
		 	mt.setValue("UNREACH",false);
		 }

		this.initialized = true;
		logger.debug("Device Init completed");
		} else {
			logger.error("Device data file is corrupt");
		}
		}
		catch (err) {
			logger.error("Device data file is corrupt %s",err);
		}
	}
	} else {
		logger.error("PANIC ! No data found for %s at %s. Giving up. Please file a bug at https://github.com/thkl/Homematic-Virtual-Interface/issues", deviceType ,cfgFile);
	}
	
}

HomematicDevice.prototype.initWithStoredData = function(storedData) {

  if (storedData == undefined) {
	  logger.warn("Stored Data is null");	
  } else {
	  var j_storedData = JSON.parse(storedData);
  }

  var serial = j_storedData["serialNumber"];
  var published = j_storedData["wasPublished"];
  var adress = j_storedData["adress"];
  var firmware = j_storedData["firmware"];
  var paramsets = j_storedData["paramsets"];
  var type = j_storedData["type"];
  var version = j_storedData["version"];
  var that = this;
  
  if (serial!=undefined) {this.serialNumber = serial;}
  if (type!=undefined) {this.type = type;}
  if (adress!=undefined) {this.adress = adress;}
  if (firmware!=undefined) {this.firmware = firmware;}
  if (version!=undefined) {this.version = version;}
  if (published!=undefined) {this.wasPublished = published;}
  
  var j_channels = j_storedData["channels"];

  if ((serial==undefined) || (adress==undefined) || (j_channels == undefined)) {
	  logger.debug("Cannot init device from storedData %s %s %s . Do not panic. There will be a shiny new one is just a second.",serial,adress,j_channels);
	  return false;
  } 

  if (j_channels != undefined) {
 
  j_channels.forEach(function (channel) {
	var cadress = channel["adress"];
		var hm_channel = new HomematicChannel(adress,type,channel["index"],
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		that.addChannel(hm_channel);
		});
  }
  		
  if (paramsets!=undefined) {
	paramsets.forEach(function (pSet) {
	 var ps = new HomematicParameterSet(pSet["name"],pSet["id"]);
     var parameter = pSet["parameter"];
     if (parameter != undefined) {
      
      parameter.forEach(function (jParameter) {
    	var p = new HomematicParameter(jParameter);
    	ps.addParameter(p);
      });
     } 
    
    that.paramsets.push(ps);
    });
 }
 
 // set LOWBAT to false
 var mt = this.getChannelWithTypeAndIndex("MAINTENANCE",0);
 if (mt) {
	 mt.setValue("LOWBAT",false);
	 mt.setValue("CONFIG_PENDING",false);
	 mt.setValue("STICKY_UNREACH",false);
	 mt.setValue("UNREACH",false);
 }

 
 this.initialized = true;
 EventEmitter.call(this)
}


 
HomematicDevice.prototype.addChannel = function(channel) {
	 var that = this;
	 
	 this.channels.push(channel);
	 
	 channel.on('channel_value_change', function(parameter){
	  parameter["device"] = that.adress;
	  logger.debug("Channel Value event %s",parameter.name);
      that.emit('device_channel_value_change', parameter);
     });
     
     channel.on('event_channel_value_change', function(parameter){
	  parameter["device"] = that.adress;
      that.emit('event_device_channel_value_change', parameter);
     });
 }
 
HomematicDevice.prototype.getChannel = function(channelAdress) {
   var result = undefined;
   
   this.channels.forEach(function (channel) {
     if (channelAdress == channel.adress) {
      result = channel;
     }
   });
   return result;
 }


HomematicDevice.prototype.resetConfigPending = function() {
  // get the maintenance channel
  var channel = this.getChannelWithTypeAndIndex("MAINTENANCE",0);
  if (channel) {
	  logger.debug("Reset Config Pending");
	  channel.setValue("CONFIG_PENDING",false);
  }
}

HomematicDevice.prototype.getChannelWithTypeAndIndex = function(type,cindex) {
   var result = undefined;
   
   this.channels.forEach(function (channel) {
     if ((type == channel.type) && (cindex == channel.index)) {
      result = channel;
     }
   });
   return result;
 }

 
HomematicDevice.prototype.getDeviceDescription = function(paramset) {
   
   var result = {};
   
   var psetNames = [];
   var chAdrNames = [];

   this.paramsets.forEach(function (pSet) {
    psetNames.push(pSet.name);
   });
   
   this.channels.forEach(function (channel) {
    chAdrNames.push(channel.adress);
   })

   result ['ADDRESS'] = this.adress ;
   result ['CHILDREN'] = chAdrNames ;
   result ['FIRMWARE'] = this.firmware;
   result ['FLAGS'] = 1 ;
   result ['INTERFACE'] = "HM_Virtual" ;
   result ['PARAMSETS'] = psetNames;
   result ['PARENT'] = undefined ;
   result ['RF_ADDRESS'] = 0;
   result ['ROAMING'] = 0;
   result ['RX_MODE'] = 1;
   result ['TYPE'] = this.type ;
   result ['UPDATABLE'] = 1 ;
   result ['VERSION'] = this.version ;
   
   return result;
 
 }

HomematicDevice.prototype.getParamsetId = function(paramset) { 
   var result = [];

  if (paramset == undefined) {
    paramset = "MASTER";
  } 
  
  if (paramset == this.adress) {
    paramset = "LINK";
  }
  
   this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
      result = pSet.getParamsetId();
    }
   });
   return result;

 }

HomematicDevice.prototype.getParamset = function(paramset) { 
  var result = [];
  if (paramset == undefined) {
    paramset = "MASTER";
  }
  
  if (paramset == this.adress) {
    paramset = "LINK";
  }
  
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
      result = pSet.getParamset();
    }
   });
   return result;
 }

HomematicDevice.prototype.getParamsetDescription = function(paramset) {
  var result = [];
  
  if (paramset == undefined) {
    paramset = "MASTER";
  }
  
  if (paramset == this.adress) {
    paramset = "LINK";
  }
  
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
      result = pSet.getParamsetDescription();
    }
   });
   return result;
 }


HomematicDevice.prototype.putParamset = function(paramset,parameter) {
  var result = [];
  
  if (paramset == undefined) {
    paramset = "MASTER";
  }
  
  if (paramset == this.adress) {
    paramset = "LINK";
  }
  
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
     	for (var key in parameter) {
          var value = parameter[key];
       	  pSet.putParamsetValue(key,value);
        }
    }
  });
  
  return this.getParamset(paramset);;
 }

HomematicDevice.prototype.savePersistent = function() {
	return (JSON.stringify(this));	
}

module.exports = {
  HomematicDevice : HomematicDevice
}
