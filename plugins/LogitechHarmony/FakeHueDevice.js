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


var FakeHueDevice = function (hueserver,fobject) {
	this.hueserver = hueserver;
	this.log = hueserver.log;
	this.light;
	this.hmDevice;
	this.bridge = hueserver.bridge;
	this.name = fobject["name"]
	this.objType = fobject["type"]
	this.index = fobject["index"]
	this.adress = fobject["adress"]
	this.ctype = fobject["ctype"]
	this.isReal = false;
	this.rpcClient = this.hueserver.plugin.hm_layer.addRPCClient("BidCos-RF")
	this.log.debug("Fake Data %s",fobject)
	this.init();
}	
	
	
FakeHueDevice.prototype.init = function() {
  var that = this;
  	
  this.light = new Fakelight(this.log,this.index,this.name,false)

  var hmdtype = this.getCCUDeviceType(this.objType);
  if (hmdtype) {
  	this.initHMDevice(hmtype)
  } else {
  	this.initRealDevice()
  }
  this.hueserver.addLightDevice(this);
}

FakeHueDevice.prototype.initRealDevice = function(hmtype) {
  var that = this
  this.light.on("harmony_device_value_change", function(lightid,parameter,state){
	  that.log.debug("Event -> Set %s to %s Object Type ",parameter,state,that.objType);

	  if (that.objType == "3") {
	  // HM Device
	  if ((parameter=="bri") && (state > 0)) {
		if (that.ctype == "DIMMER") {
			that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"LEVEL",{"explicitDouble":(state/255)}], function(error, value) {});
  		}
	  }	   
	  
	  if (parameter == "on") {
		
		if (that.ctype == "SWITCH") {
			that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"STATE",state], function(error, value) {});
		}
		
		if (that.ctype == "DIMMER") {
			if (state == true) {
				that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"LEVEL",{"explicitDouble":1}], function(error, value) {});
			} else {
				that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"LEVEL",{"explicitDouble":0}], function(error, value) {});
			}
  		}

	  }
	  
	  }
	  
	  // HM Program
 	 if (that.objType == "4") {
	 	if (parameter=="on") {
	 		that.bridge.runRegaScript("var x = dom.GetObject('" +  that.adress.slice(2) + "');if (x) {x.ProgramExecute();}");
	 	}
	 }
	 
	 
  })
}

FakeHueDevice.prototype.initHMDevice = function(hmtype) {
	
  var deviceSerial = "Harmony_"  + this.light.uniqueid
  HomematicDevice = this.bridge.homematicDevice
  
  this.hmDevice = new HomematicDevice(this.name);
  this.hmtype = hmtype;
  this.log.debug("Init new Fake Hue Device for CCU %s With type %s",deviceSerial,JSON.stringify(this.hmType));

  var data = this.bridge.deviceDataWithSerial(deviceSerial);
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
    }

	this.log.debug("HM Device %s - %s",this.hmDevice,this.hmDevice.initialized);
	if (this.hmDevice.initialized == false) {
		this.hmDevice.initWithType(hmtype, deviceSerial );
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
			  	sw_channel.updateValue("STATE",true,true,true);
			  }
			  break;
			  
			  case "DIMMER": {
			  	var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
			  	sw_channel.updateValue("LEVEL",{"explicitDouble":(state/255)},true,true);
			  }
		  }

	  }
	  
	  if (parameter=="on") {
		  
		  switch (that.hmType["channel"]) {
			  
			  case "SWITCH": {
			  	var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("SWITCH","1");
			  	sw_channel.updateValue("STATE",state,true,true);
			  }
			  break;
			  
			  case "DIMMER": {
			  	if (state == false) {
			  		var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
			  		sw_channel.updateValue("LEVEL",{"explicitDouble":0},true,true);
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
}

FakeHueDevice.prototype.getCCUDeviceType = function(idtype) {
   if (hmtypes.length>idtype) {
	   return hmtypes[idtype];
   }
   return undefined;
}

FakeHueDevice.prototype.getType = function() {
  return this.hmDevice.type;
}

module.exports = {
  FakeHueDevice : FakeHueDevice
}
