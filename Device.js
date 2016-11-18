"use strict";

var debug = require('debug')('HomeMaticHueBridge.Device');
var ParameterSet = require("./ParameterSet.js").ParameterSet;
var Parameter = require("./Parameter.js").Parameter;
var fs = require('fs');
var Channel = require("./Channel.js").Channel;
const EventEmitter = require('events');
const util = require('util');

var Device = function(deviceType,adress) {
	
	var that = this;

	this.channels = [];
    this.paramsets = [];
    this.version = 1;
    this.firmware = "1.0";
    
    var cfgFile = "devices/" + deviceType +".json";
	fs.accessSync(cfgFile, fs.F_OK);
    var data = fs.readFileSync(cfgFile	).toString();
	if (data != undefined) {
		debug("DeviceData for " + deviceType + " found. Create new Device");
	 	var json = JSON.parse(data);
	 	
	 	this.type = deviceType;
	 	this.adress = adress;
	 	json["channels"].forEach(function (channel) {
			
		   

		   var hm_channel = new Channel(adress,deviceType,channel["adress"],
		   								channel["type"],channel["flags"],
		   								channel["direction"],channel["paramsets"],
		   								channel["version"]);
		   that.addChannel(hm_channel);
		   
		});
		
	var mps = json["paramsets"];
	mps.forEach(function (pSet) {
	 var ps = new ParameterSet(pSet["name"],pSet["id"]);
     var parameter = pSet["parameter"];
     if (parameter != undefined) {
      
      parameter.forEach(function (jParameter) {
    	var p = new Parameter(jParameter);
    	ps.addParameter(p);
      });
     } 
    
    that.paramsets.push(ps);
    });
    
    this.version = json["version"];
    
	}
  EventEmitter.call(this)
}

util.inherits(Device, EventEmitter);
 
 Device.prototype.addChannel = function(channel) {
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
 
 Device.prototype.getChannel = function(channelAdress) {
   var result = undefined;
   
   this.channels.forEach(function (channel) {
     if (channelAdress == channel.adress) {
      result = channel;
     }
   });
   return result;
 }


 Device.prototype.getChannelWithTypeAndIndex = function(type,cindex) {
   var result = undefined;
   
   this.channels.forEach(function (channel) {
     if ((type == channel.type) && (cindex == channel.index)) {
      result = channel;
     }
   });
   return result;
 }

 
 Device.prototype.getDeviceDescription = function(paramset) {
   
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

 Device.prototype.getParamsetId = function(paramset) { 
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

 Device.prototype.getParamset = function(paramset) { 
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

 Device.prototype.getParamsetDescription = function(paramset) {
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


Device.prototype.putParamset = function(paramset,parameter) {
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
  Device : Device
}
