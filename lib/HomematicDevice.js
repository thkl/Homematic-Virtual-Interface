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
var Logger = require(__dirname + '/Log.js').Logger;
var logger = new Logger("HomematicDevice");

const EventEmitter = require('events');
const util = require('util');

var HomematicDevice = function(deviceType,adress) {
	var that = this;

	this.channels = [];
    this.paramsets = [];
    this.version = 1;
    this.firmware = "1.0";
    var cfgFile = path.join(path.dirname(fs.realpathSync(__filename)), '../devices' , deviceType) + '.json';
	logger.debug("Config at "+cfgFile);
   
	fs.accessSync(cfgFile, fs.F_OK);
    var data = fs.readFileSync(cfgFile	).toString();
	if (data != undefined) {
		logger.debug("DeviceData for " + deviceType + " found. Create new Device");
	 	var json = JSON.parse(data);
	 	
	 	this.type = deviceType;
	 	this.adress = adress;
	 	json["channels"].forEach(function (channel) {
			var cadress = channel["adress"];
			// check this channel definition is valid for multiple adresses
			if (Array.isArray(cadress)) {
				// map each one to the same channeltype
			  cadress.map(function(adr){
				var hm_channel = new HomematicChannel(adress,deviceType,adr,
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		   		that.addChannel(hm_channel);
				  
				  
			  });
			} else {
				// single one ... normal init
				var hm_channel = new HomematicChannel(adress,deviceType,cadress,
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		   		that.addChannel(hm_channel);
			}
		   
		});
		
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
    
    this.version = json["version"];
    
	}
  EventEmitter.call(this)
}

util.inherits(HomematicDevice, EventEmitter);
 
HomematicDevice.prototype.addChannel = function(channel) {
	 var that = this;
	 this.channels.push(channel);

	 channel.on('channel_value_change', function(parameter){
	  parameter["device"] = that.adress;
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
 }



module.exports = {
  HomematicDevice : HomematicDevice
}
