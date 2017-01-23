//
//  PioneerRemote.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 23.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var Pioneer_Remote = function(pioneer_bridge) {
	this.log = pioneer_bridge.log;
	this.log.debug("init remote");	
	this.pioneer_bridge = pioneer_bridge;
	this.server = pioneer_bridge.server;
	this.bridge = this.server.getBridge();
}


Pioneer_Remote.prototype.init = function(remoteName,index,HomematicDevice) {
	this.hmDevice = new HomematicDevice();
	this.index = index;
	var that = this;
	
	var data = this.bridge.deviceDataWithSerial(remoteName);
		
		if (data!=undefined) {
			this.hmDevice.initWithStoredData(data);
		} 
		if (this.hmDevice.initialized == false) {
			this.hmDevice.initWithType("HM-RC-19_Pioneer",remoteName);
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
				
				if (that.index == 0) {
					switch (channel.index) {
					case "1":
						that.sendCommand("PO\r");
						break;
					case "2":
						that.sendCommand("PF\r");
						break;
					case "3":
						that.sendCommand("VD\r");
						break;
					case "4":
						that.sendCommand("VU\r");
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
							that.sendCommand(func + "\r");
						}
					break;
			
					}

				} else {
					var func = that.functionForChannel(parameter.name, channel);
						if (func != undefined) {
							that.sendCommand(func + "\r");
					}	
				}
			}
		});
}

Pioneer_Remote.prototype.removeFromHMLayer=function() {
	this.bridge.deleteDeviceTemporary(this.hmDevice);
}


Pioneer_Remote.prototype.setVolume=function(newVolume) {
	this.pioneer_bridge.setVolume(newVolume);
}

Pioneer_Remote.prototype.functionForChannel=function(type,channel) {
	var result = channel.getParamsetValueWithDefault("MASTER","CMD_" + type,"");
	this.log.debug("Getting %s Result is %s","CMD_" + type,result);
	return result;
}

Pioneer_Remote.prototype.sendCommand=function(command) {
	this.pioneer_bridge.sendCommand(command);
}

module.exports = {Pioneer_Remote : Pioneer_Remote}
