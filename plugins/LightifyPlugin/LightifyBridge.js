//
//  LightifyBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var lightify = require("node-lightify");
var url = require("url");
var LightifyDevice = require("./LightifyDevice.js").LightifyDevice;

var LightifyBridge = function(plugin,name,server,log) {
	this.plugin = plugin;
	this.mappedDevices = [];
	this.api;
	this.server = server;
	this.log = log;
	this.lights = [];
	this.groups = [];
	this.name = name;
}


LightifyBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	
	this.log.info("Init %s",this.name);
	var ip = this.configuration.getValueForPlugin(this.name,"ip");
	
	if (ip == undefined) {
		this.log.error("Please setup Lightify ip in your config.json")
    } else {
	    
	lightify.start(ip).then(function(data){
    	return lightify.discovery();
	}).then(function(data) {
	
	if ((data != undefined) && (data.result != undefined))	
	
		data.result.forEach(function (light) {
			that.log.debug("LFLight %s",light);
			if (light["type"]=="10") {
    			that.log.debug("Create new Osram Light " + light["name"]);
    			var name = "VIR-LG-" + light["name"].replace(" ", "_");
				var hd = new LightifyDevice(that,lightify,light,name);
				light["hm_device_name"] = light["name"];
    		}
    		
    		that.lights.push(light);
    		that.mappedDevices.push(hd);
		});	
	  	
	})
    
    }    
}


LightifyBridge.prototype.handleConfigurationRequest = function(dispatched_request) {

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listLights":""});
}

module.exports = {
  LightifyBridge : LightifyBridge
}
