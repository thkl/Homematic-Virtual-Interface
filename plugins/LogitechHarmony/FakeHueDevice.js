'use strict'

//
//  FakeHueDevice.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var Fakelight = require(__dirname + '/device/Fakelight.js').Fakelight;
var HomematicDevice;

var hmtypes = {"0":{"type":"HM-LC-Sw1-Pl","channel":"SWITCH"},
			   "1":{"type":"HM-LC-Dim1T-Pl","channel":"DIMMER"}};


var FakeHueDevice = function (hueserver,name,type,index) {
	this.hueserver = hueserver;
	this.log = hueserver.log;

	this.light;
	this.hmDevice;
	this.bridge = hueserver.bridge;
	this.name = name;
	this.index = index;
	this.isReal = false;
	this.hmType = hmtypes[type];
	this.init();
}	
	
	
FakeHueDevice.prototype.init = function() {
  var that = this;
  	
  this.light = new Fakelight(this.log,this.index,this.name,false)
  var deviceSerial = "Harmony_"  + this.light.uniqueid;
  HomematicDevice = this.bridge.homematicDevice;
  
  this.hmDevice = new HomematicDevice();
  
  this.log.debug("Init new Fake Hue Device for CCU %s With type %s",deviceSerial,JSON.stringify(this.hmType));
  
  var data = this.bridge.deviceDataWithSerial(deviceSerial);
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
    }

  this.log.debug("HM Device %s - %s",this.hmDevice,this.hmDevice.initialized);
  if (this.hmDevice.initialized == false) {
  	this.hmDevice.initWithType(this.hmType["type"], deviceSerial );
  	this.hmDevice.firmware = "0.0.1";
  	this.bridge.addDevice(this.hmDevice,true);
  } else {
    this.bridge.addDevice(this.hmDevice,false);
  }

  this.light.on("harmony_device_value_change", function(lightid,parameter,state){
	  that.log.debug("Event -> Set %s to %s",parameter,state);
	  if ((parameter=="bri") && (state > 0)) {
		  
		 switch (that.hmType["channel"]) {
			  
			  case "SWITCH": {
			  	var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("SWITCH","1");
			  	sw_channel.updateValue("STATE",1,true);
			  }
			  break;
			  
			  case "DIMMER": {
			  	var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
			  	sw_channel.updateValue("LEVEL",(state/255),true);
			  }
		  }

	  }
	  
	  if (parameter=="on") {
		  
		  switch (that.hmType["channel"]) {
			  
			  case "SWITCH": {
			  	var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("SWITCH","1");
			  	sw_channel.updateValue("STATE",(state==true)?1:0,true);
			  }
			  break;
			  
			  case "DIMMER": {
			  	if (state == false) {
			  		var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
			  		sw_channel.updateValue("LEVEL",0,true);
			  	}
			  }
		  }
	  }


  });
  
  
  this.hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = that.hmDevice.getChannel(parameter.channel);
		
		
		switch (that.hmType["channel"]) {
			  
			  case "SWITCH": {
			  	that.light.isOn = newValue;
			  }
			  break;
			  
			  case "DIMMER": {
			  	that.light.isOn = (newValue == 0)
			  	that.light.bri = newValue*255;
			  }
		  }
		  
	});
	
  this.hueserver.addLightDevice(this);
}

FakeHueDevice.prototype.getType = function() {
  return this.hmDevice.type;
}

module.exports = {
  FakeHueDevice : FakeHueDevice
}
