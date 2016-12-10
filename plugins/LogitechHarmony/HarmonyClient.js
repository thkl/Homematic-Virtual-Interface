
//
//  HarmonyClient.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var harmony = require('harmonyhubjs-client');
var HomematicDevice;

var HarmonyClient = function (plugin) {
	this.name = plugin.name;
	this.plugin = plugin;
	this.log = this.plugin.log;
	this.server = this.plugin.server;
	this.config = this.server.configuration;
	this.bridge = this.server.getBridge();
	this.activities = [];
	this.hubIP = this.config.getValueForPluginWithDefault(this.name,"hub_ip",undefined);

	this.init();
}

HarmonyClient.prototype.init = function() {
  var that = this;
  HomematicDevice = this.server.homematicDevice;
  var hmDevice = new HomematicDevice();
  hmDevice.initWithType("HM-RC-19", "HarmonyActivities");
  this.bridge.addDevice(hmDevice);
  var adx = 1;  
  harmony(this.hubIP).then(function(harmonyClient) {
	  harmonyClient.getActivities().then(function(activities) {
		activities.forEach(function (activity){
			var ac = {"id":activity.id,"label":activity.label,"adress":adx};
			that.activities.push(ac);
			adx = adx + 1;
		});
		that.log.debug("Activities : %",JSON.stringify(that.activities));
	  }).finally(function () {
	  that.log.debug("Closing");
        harmonyClient.end()
  }).catch(function (e) {
    that.log.error(e);
  });
  });
  
  hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = hmDevice.getChannel(parameter.channel);
		if (parameter.name == "PRESS_SHORT") {
			
			var selectedActivity = that.activities
                .filter(function (activity) { return activity.adress == channel.index}).pop()
			if (selectedActivity != undefined) {
			  that.startActivity(selectedActivity.id);
			} else {
				that.log.debug("No Activity With Index %s found",channel.index);
			}
		
	    }
	});
}

HarmonyClient.prototype.getActivities = function() {
  return this.activities;
}

HarmonyClient.prototype.startActivity = function(acId) {
  this.log.debug("Run Activity With ID %s",acId);
  var that = this;
  harmony(this.hubIP).then(function(harmonyClient) {
	  harmonyClient.startActivity(acId);
	  that.log.debug("Closing");
     harmonyClient.end();
  }).catch(function (e) {
    that.log.error(e);
  })	
}


module.exports = {
  HarmonyClient : HarmonyClient
}