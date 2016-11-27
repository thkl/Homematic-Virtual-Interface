//
//  NetAtmoBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 26.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var netatmo = require('netatmo');
var NetAtmoDevice = require(__dirname + "/NetAtmoDevice.js").NetAtmoDevice;


var NetAtmoBridge = function(plugin,name,server,log) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.bridge = server.getBridge();
	this.devices = [];
	HomematicDevice = server.homematicDevice;
}


NetAtmoBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	
	
	var auth = this.configuration.getValueForPlugin(this.name,"auth");
	if (auth != undefined) {
		var client_id =  auth["client_id"];
		var client_secret = auth["client_secret"];
		var username = auth["username"];
		var password = auth["password"];
	}

	if ((client_id == undefined) || (client_secret == undefined) || (username == undefined) || (password == undefined)) {
		this.log.error("Please setup your netatmo credentials in your config.json ... see ReadMe.")
	} else {
		
		var api = new netatmo(auth);
		var i = 0;
		
		api.getStationsData(function(err, devices) {
			devices.forEach(function (device) {
				that.log.debug("Create new NetAtmo Device " + device["station_name"]);
				var nadevice = new NetAtmoDevice(that,api,device,"NAT0000" + i);
				that.devices.push(nadevice);
				i = i+1;
			});
		});
		
	}
	

	
	

}

NetAtmoBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	var strDevice = "";
	var that = this;
	var devicetemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
    this.devices.forEach(function (device){
	   strDevice = strDevice + dispatched_request.fillTemplate(devicetemplate,{"device_name":device.name,"device_hmdevice":device.hm_device_name});
    });
    
    var lvlAdded = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED",1000);
	var lvlStrong = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED_STRONG",1400);
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listDevices":strDevice,"settings.co2_added":lvlAdded,"settings.co2_strong":lvlStrong});
}


module.exports = {
  NetAtmoBridge : NetAtmoBridge
}
