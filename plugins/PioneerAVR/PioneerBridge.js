//
//  PioneerBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 07.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var avr = require(__dirname + '/pioneer-avr.js');
var path = require('path');


var PioneerBridge = function(plugin,name,server,log) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.bridge = server.getBridge();
	HomematicDevice = server.homematicDevice;
	this.receiver;
}


PioneerBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	this.hmDevice = new HomematicDevice();
	var avrName = "PioneerAVR";
	
	var data = this.bridge.deviceDataWithSerial(avrName);
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
	} 
	
	if (this.hmDevice.initialized == false) {
		this.hmDevice.initWithType("HM-RC-19_Pioneer",avrName);
		this.bridge.addDevice(this.hmDevice,true);
	} else {
		this.bridge.addDevice(this.hmDevice,false);
	}
    
    this.hmDevice.on('device_channel_value_change', function(parameter){
		var newValue = parameter.newValue;
		
		if (parameter.name == "TARGET_VOLUME") {
			    
			var newVolume = parameter.newValue;
			that.setVolume(newVolume);							    

		} else {
			
		var channel = that.hmDevice.getChannel(parameter.channel);
		that.log.debug("Channel Index is %s",channel.index);
		switch (channel.index) {
			
			case "1":
				that.sendCommand("PO\r");
				break;
			case "2":
				that.sendCommand("PF\r");
				break;
			case "3":
				that.sendCommand("VU\r");
				break;
			case "4":
				that.sendCommand("VD\r");
				break;
			case "5":
				that.sendCommand("MO\r");
				break;
			case "6":
				that.sendCommand("MF\r");
				break;
			case "7":
			case "8":
			case "9":
			case "10":
			case "11":
			case "12":
			case "13":
			case "14":
			case "15":
			case "16":
			case "17":
			case "18":
				var func = that.functionForChannel(parameter.name, channel);
				if (func != undefined) {
					that.sendCommand(func);
				}
			break;
			
		}

		}
	});

	setTimeout(function() {that.reconnect()},1000);
}


PioneerBridge.prototype.reconnect = function(command) {
	var that = this;
	var hop = this.configuration.getValueForPlugin(this.name,"options");
	if (hop != undefined) {
		var options = {port: hop["port"],host: hop["host"],log: false};
		this.receiver = new avr.VSX(options);
		
		this.receiver.on("connect", function() {
			that.log.info("Connection to the AVR");
		});
		
		this.receiver.on("end", function () {
        	that.log.debug("End ... Reconnecting in 1 second");
			setTimeout(function() {that.reconnect()},1000);
        });
        
        this.receiver.on("error", function () {
        	that.log.debug("Error Reconnecting in 60 seconds");
			setTimeout(function() {that.reconnect()},60000);
        });

    }
}

PioneerBridge.prototype.sendCommand = function(command) {
 var that = this;
 try {
	this.log.debug("Sending Command %s",command);
	this.receiver.sendCommand(command);
  } catch (err) {that.log.error("Error while sending command %s",err)}
}

PioneerBridge.prototype.setVolume = function(newVolume) {
 var that = this;
 try {
	this.log.debug("Sending NewVolume %s",newVolume);
	this.receiver.volume(newVolume);
 } catch (err) {that.log.error("Error while sending command %s",err)}
}



PioneerBridge.prototype.functionForChannel=function(type,channel) {
	var result = channel.getParamsetValueWithDefault("MASTER","CMD_" + type,"");
	return result;
}


PioneerBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",undefined);
}


module.exports = {
  PioneerBridge : PioneerBridge
}
