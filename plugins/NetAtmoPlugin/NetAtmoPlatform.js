//
//  NetAtmoPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 26.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var netatmo = require('netatmo');
var NetAtmoDevice = require(__dirname + "/NetAtmoDevice.js").NetAtmoDevice;
var url = require("url");
var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");


function NetAtmoPlatform(plugin,name,server,log,instance) {
	NetAtmoPlatform.super_.apply(this,arguments);
	this.bridge = server.getBridge();
	this.devices = [];
	HomematicDevice = server.homematicDevice;
}

util.inherits(NetAtmoPlatform, HomematicVirtualPlatform);



NetAtmoPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

	
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
		this.connectApi(auth);
	}
}

NetAtmoPlatform.prototype.connectApi = function(auth) {
	auth['scope'] = "read_station read_thermostat"
var api = new netatmo(auth);
var i = 0;
var that = this;		
api.getStationsData(function(err, devices) {
	devices.forEach(function (device) {
		that.log.debug("Create new NetAtmo Device " + device["station_name"]);
		that.nadevice = new NetAtmoDevice(that,api,device,"NAT00" + i);
		that.devices.push(that.nadevice);
		i = i+1;
	});
});

api.on("error", function(error) {
    // When the "error" event is emitted, this is called
    that.log.error('Netatmo threw an error: ' + error);
});

api.on("warning", function(error) {
    // When the "warning" event is emitted, this is called
    that.log.log('Netatmo threw a warning: ' + error);
});

}


NetAtmoPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request);
	var result = [];
	var client_id = "";
	var client_secret = "";
	var username = "";
	var password = "";
	
	var auth = this.configuration.getValueForPlugin(this.name,"auth");
	this.log.debug(auth);
	if (auth != undefined) {
		client_id =  auth["client_id"] || "";
		client_secret = auth["client_secret"]  || "";
		username = auth["username"] || "";
		password = auth["password"] || "";
	} 
	
	result.push({"control":"text","name":"client_id","label":this.localization.localize("Client ID"),"value":client_id,"size":30});
	result.push({"control":"password","name":"client_secret","label":this.localization.localize("Client Secret"),"value":client_secret,"size":30});
	result.push({"control":"text","name":"username","label":this.localization.localize("Username"),"value":username,"size":30});
	result.push({"control":"password","name":"password","label":this.localization.localize("Password"),"value":password,"size":30});
	
	return result;
}

NetAtmoPlatform.prototype.saveSettings = function(settings) {
	var that = this
	
	if  ((settings.client_id) && (settings.client_secret) && (settings.username) && (settings.password))  {
		var auth = {"client_id":settings.client_id,
					"client_secret":settings.client_secret,
					"username":settings.username,
					"password":settings.password}
		this.configuration.setValueForPlugin(this.name,"auth",auth); 
		this.removeMyDevices();
		this.connectApi(auth);
	}
}

NetAtmoPlatform.prototype.removeMyDevices = function() {
  var that = this;
  this.hm_layer.deleteDevicesByOwner(this.plugin.name);
}

NetAtmoPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var strDevice = "";
	var that = this;
	var devicetemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
    this.devices.forEach(function (device){
	   strDevice = strDevice + dispatched_request.fillTemplate(devicetemplate,{"device_name":device.name,"device_hmdevice":device.hm_device_name});
    });
    
    if (dispatched_request.post != undefined) {
	
	    this.log.debug(JSON.stringify(dispatched_request.post));
	
		switch (dispatched_request.post["do"]) {
			
			
			case "settings.save":
			{
				var CO2_ADDED = dispatched_request.post["settings.co2_added"];
				var CO2_ADDED_STRONG = dispatched_request.post["settings.co2_strong"];
				var refresh = dispatched_request.post["settings.refresh"];

				this.configuration.setPersistValueForPlugin(this.name,"refresh",refresh); 
				this.configuration.setPersistValueForPlugin(this.name,"CO2_ADDED",CO2_ADDED); 
				this.configuration.setPersistValueForPlugin(this.name,"CO2_ADDED_STRONG",CO2_ADDED_STRONG); 
			}
			break;	
		}
	}
    
    var lvlAdded = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED",1000);
	var lvlStrong = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED_STRONG",1400);
	var refresh = this.configuration.getPersistValueForPluginWithDefault(this.name,"refresh",360);

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listDevices":strDevice,
		"settings.co2_added":lvlAdded,
		"settings.refresh":refresh,
		"settings.co2_strong":lvlStrong});
}


module.exports = NetAtmoPlatform;