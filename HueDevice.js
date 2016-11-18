"use strict";


var Channel = require("./Channel.js").Channel;
var Device = require("./Device.js").Device;
var debug = require('debug')('HomeMaticHueBridge.HueDevice');


var HueDevice = function(hmbridge, hueApi ,light) {

	debug("Setup new HUE Bridge Device");
	
	this.api =  hueApi;
	this.bridge = hmbridge;
	this.lightId = light["id"];
	this.hmDevice = new Device("HM-LC-RGBW-WM","HUE0000" + this.lightId );
	this.bridge.addDevice(this.hmDevice);

	// Add Level Listener
	
	var that = this;
	
	
	this.hmDevice.on('device_channel_value_change', function(parameter){
      debug("Value was changed " + JSON.stringify(parameter) );
      var newValue = parameter.newValue;
      var channel = that.hmDevice.getChannel(parameter.channel);
      
      if (parameter.name == "INSTALL_TEST") {
      
      if (channel != undefined) {
        channel.startUpdating("INSTALL_TEST");
      }
      
      that.api.setLightState(that.lightId,{"alert":"lselect"}, function(err, result) {
      if (channel != undefined) {
        channel.updateValue("INSTALL_TEST",false);
        channel.endUpdating("INSTALL_TEST");
      }
      });
      
      }
      
      
      if (parameter.name == "LEVEL") {

      var newState = {};      
      if (newValue > 0) {
        newState["on"] = true;
        newState["bri"] = (newValue/1)*255;
        
      } else {
        newState["on"] = false;
        newState["bri"] = 0;
      }

	  debug("Hue Value set to " + JSON.stringify(newState) );
      
      if (channel != undefined) {
        channel.startUpdating("LEVEL");
      }
      
      that.api.setLightState(that.lightId,newState, function(err, result) {
      if (channel != undefined) {
        channel.endUpdating("LEVEL");
      }
      });
     
     }
     
     if (parameter.name == "COLOR") {

      var newState = {};      
      if (newValue == 200) {
      // SpeZiale
        newState["rgb"] = {r:255,g:255,b:255};
        
      } else {
        newState["hue"] = (newValue/199)*65535;
      }

	  debug("Hue Value set to " + JSON.stringify(newState) );
      
      if (channel != undefined) {
        channel.startUpdating("COLOR");
      }
      
      that.api.setLightState(that.lightId,newState, function(err, result) {
      if (channel != undefined) {
        channel.endUpdating("COLOR");
      }
      });
     
     }

      
    });
}



module.exports = {
  HueDevice : HueDevice
}
