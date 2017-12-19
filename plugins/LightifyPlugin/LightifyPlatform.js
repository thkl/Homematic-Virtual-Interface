//
//  LightifyPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

const lightify = require('node-lightify')
const url = require('url')
var LightifyRGBDevice = require("./LightifyRGBDevice.js").LightifyRGBDevice;
var LightifyWhiteDevice = require("./LightifyWhiteDevice.js").LightifyWhiteDevice;
const path = require('path')
const fs = require('fs')

var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");
var HomematicDevice;

function LightifyPlatform(plugin,name,server,log,instance) {
	LightifyPlatform.super_.apply(this,arguments);
	this.mappedDevices = [];
	this.lights = [];
	this.alexa_appliances = {};
	this.server = server
	HomematicDevice = server.homematicDevice;
	// transport device defs
	var devfile = path.join(__dirname,'VIR-LG-WHITE-DIM.json');
    var buffer = fs.readFileSync(devfile);
    try {
	    var devdata = JSON.parse(buffer.toString());
		this.server.transferHMDevice('VIR-LG-WHITE-DIM',devdata);
    } catch (e) {
	    this.log.error(e) 
	}
}

util.inherits(LightifyPlatform, HomematicVirtualPlatform);

LightifyPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	
	this.log.info("Init %s",this.name);
	this.gatewayIP = this.configuration.getValueForPlugin(this.name,"ip");

	if (this.gatewayIP == undefined) {
		this.log.error("Please setup Lightify ip in your config.json")
    } else {
	    this.log.info("Config IP found .. trying to setup connection to lf")
		this.reInit()
    }    
}

LightifyPlatform.prototype.reInit = function() {
  var that = this
  this.mappedDevices = []
  this.lights = [];

  if (this.connection != undefined) {
	  this.connection.dispose();
  }

  this.connection = new lightify.lightify(this.gatewayIP);
  this.connection.connect().then(function(){
    return that.connection.discover();
  }).then(function(data) {
		data.result.forEach(function (light) {
		that.log.info("LFLight %s (%s)",light["name"],light["type"]);
		
			if (light["type"]=="10") {
    			that.log.debug("Create new Osram RGB Light " + light["name"]);
    			var name = "VIR-LG-" + light["name"].replace(" ", "_");
				var hd = new LightifyRGBDevice(that,that.connection,light,name);
				light["hm_device_name"] = light["name"];
				that.lights.push(light);
	    		that.mappedDevices.push(hd);
    		}
    		
    		if (light["type"]=="2") {
    			that.log.debug("Create new Osram White Light " + light["name"]);
    			var name = "VIR-LG-" + light["name"].replace(" ", "_");
				var hd = new LightifyWhiteDevice(that,that.connection,light,name);
				light["hm_device_name"] = light["name"];
				that.lights.push(light);
	    		that.mappedDevices.push(hd);
    		}
		})
		
  }).catch(function(error){
	that.log.error("LF Init Error %s" ,error);
  });
}


LightifyPlatform.prototype.shutdown = function() {
   this.log.info("Shutdown");
 //  this.hm_layer.deleteDevicesByOwner(this.name)
   if (this.connection != undefined) {
	  this.connection.dispose();
  }
}



LightifyPlatform.prototype.showSettings = function(dispatched_request) {
	var result = [];
	result.push({"control":"text","name":"gatewayIP","label":"IP Gateway","value":this.gatewayIP,"description":"IP of your gateway"});
	return result;
}

LightifyPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var gatewayIP = settings.gatewayIP;
	
	if (gatewayIP) {
		this.gatewayIP = gatewayIP;
	}

	this.configuration.setValueForPlugin(this.name,"ip",gatewayIP); 

	this.reInit()
}


LightifyPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listLights":""});
}

module.exports = LightifyPlatform;
