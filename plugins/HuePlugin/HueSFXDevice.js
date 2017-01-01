"use strict";
var HomematicDevice;
var Logger = require(__dirname + '/../../lib/Log.js').Logger;
var logger =  Logger.withPrefix("HueSFXDevice");


var HueSFXDevice = function(plugin) {
	this.plugin = plugin;
	this.bridge = plugin.server.getBridge();
	var that = this;
	
	HomematicDevice = plugin.server.homematicDevice;

	logger.info("Create one SFX Remote");

	var serial = "HUEFX001";
	this.hmDevice = new HomematicDevice();

	var data = this.bridge.deviceDataWithSerial(serial);
	if (data!=undefined) {
		logger.info("SFX Remote Data found");
		this.hmDevice.initWithStoredData(data);
	}
		
	if (this.hmDevice.initialized == false) {
		logger.info("Build a new");
		this.hmDevice.initWithType("HM-RC-Key4-2", serial);
		this.bridge.addDevice(this.hmDevice,true);
		logger.info("Done with the new");
	} else {
		this.bridge.addDevice(this.hmDevice,false);
 	}
		
	this.hmDevice.on('device_channel_value_change', function(parameter){
		var channel = that.hmDevice.getChannel(parameter.channel);
			
		if ((channel.index=="1") && (parameter.name == "PRESS_SHORT")) {
			
			// This is all OFf command
				
			Object.keys(that.serverList).forEach(function (name) {
				var efs = that.serverList[name];
				if (efs) {
					efs.stopScene();
				}
			});	
		}
		
		if ((channel.index=="4") && (parameter.name == "COMMAND")) {
			
			// This is a single command
			var cmds = parameter.newValue.split(".");
			if (cmds.length==2) {
				var efsx = cmds[0];
				var scene = cmds[1];
				var efs = that.serverList[efsx];
				if (efs) {
					if (scene.toLocaleString()=="stop") {
						efs.stopScene();
					} else {
						efs.runScene(scene);
					}
				}
				channel.updateValue("COMMAND","",true);
			} 
		}
	});
}


HueSFXDevice.prototype.setServerList=function(serverList) {
	this.serverList = serverList;
}



module.exports = {
	  HueSFXDevice : HueSFXDevice
}
