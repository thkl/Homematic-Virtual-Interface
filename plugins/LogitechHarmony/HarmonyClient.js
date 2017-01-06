
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
	this.intervall = this.config.getValueForPluginWithDefault(this.name,"intervall",60000);

	this.init();
}

HarmonyClient.prototype.init = function() {
  var that = this;
  HomematicDevice = this.server.homematicDevice;
  this.hmDevice = new HomematicDevice();
  this.hmDevice.initWithType("HM-RC-19_Harmony", "HarmonyActivities");
  this.bridge.addDevice(this.hmDevice);
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
  
  this.hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = that.hmDevice.getChannel(parameter.channel);
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
	
 this.getCurrentActivity();
}

HarmonyClient.prototype.getCurrentActivity = function() {
 var that = this;
 try {
	 
 harmony(this.hubIP).then(function(harmonyClient) {
	  harmonyClient.getCurrentActivity().then(function(c_activity) {
	  	
	  	that.log.debug("Responze",c_activity);

	  	var selectedActivity = that.activities.filter(function (activity) { return activity.id == c_activity}).pop();
	  	var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
	  	if (selectedActivity) {
		  	channel.updateValue("CURRENT_ACTIVITY",selectedActivity.label,true);
	  	} else {
		  	channel.updateValue("CURRENT_ACTIVITY","Unknow Activity",true);
	  	}
	  	harmonyClient.end();
   });
   
   harmonyClient.on("error",function(error){
	   that.log.error("Harmony Client Exception %s",error);
   });
   
   harmony.on("error",function(error){
	   that.log.error("Harmony Client Exception %s",error);
   });
 });
 

 } catch (ex) {
	 that.log.error(ex);
 }
 
  setTimeout(function () {
	 that.getCurrentActivity();
 }, this.intervall);	
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