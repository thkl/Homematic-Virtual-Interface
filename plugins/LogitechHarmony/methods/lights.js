
//
//  Lights.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

const util = require('util');

var Fakelight = require(__dirname + '/../device/Fakelight.js').Fakelight;

var Service_Lights = function (server,dispatched_request) {
  this.name = 'lights'
  this.server = server;
  this.log = server.log;
  this.dispatched_request = dispatched_request;
}


Service_Lights.prototype.process = function () { 
	var that = this;
	// PUT -> SET NEW STATE
	if (this.dispatched_request.method == "PUT") {
		if (this.dispatched_request.queryComponents.length > 4) {
			var lid = this.dispatched_request.queryComponents[4];
			var operation = this.dispatched_request.queryComponents[5];
			if (operation=="state") {
				
				this.dispatched_request.processPost(function() {
				    that.setLightState(lid);
				});
				
			} else {
				this.dispatched_request.sendResponse([]);
			}
		} else {
		    this.server.error(this.dispatched_request,4,this.name + "/"  ,"method, PUT, not available for resource, /lights" );
		}
		
	  return;	
	}
	
	// GET -> LIST
	if (this.dispatched_request.method == "GET") {
		
		if (this.dispatched_request.queryComponents.length > 4) {
			var lid = this.dispatched_request.queryComponents[4];
		    this.sendLightState(lid);
		} else {
		    this.sendLightState(undefined);
		}
		
		return;
	}
	
	this.server.error(this.dispatched_request,4,this.name + "/"  ,"method, " + this.dispatched_request.method + ", not available for resource, /lights" );
}

Service_Lights.prototype.setLightState = function (lightId) {
	var that = this;
	var ro = [];
	

		var light = this.server.getLight(lightId);
		if (light != undefined) {
		var data = Object.keys(this.dispatched_request.request.post);
		if (data.length>0) {
			var newStates = JSON.parse(data[0]);
			var newStateKeys = Object.keys(newStates);
			if (light.fake == false) {
					// Send thrue the real api
					that.log.debug("This is a real lamp");
					light.sendStates(newStates);		
			} else {
			
				that.log.debug("This is a fake lamp");
				newStateKeys.forEach(function (stateKey){
				var value = newStates[stateKey];
				var status = {};
				
				if (stateKey == "on") {
				  light.setOn(value);
				  status["/lights/" + lightId + "/state/" + stateKey] = light.isOn;
				} else


				if (stateKey == "bri") {
				  light.setBrightness(value);
				  status["/lights/" + lightId + "/state/" + stateKey] = light.bri;
				} else 
				
				status["/lights/" + lightId + "/state/" + stateKey] = value;
				ro.push({"success":status});
				});
			}
		}
	}
	
	
	this.dispatched_request.sendResponse(ro);		
}

Service_Lights.prototype.sendLightState = function (lightId) {
 var that = this;
 var ro = {};

 if ((lightId == undefined) || (lightId.length==0)) {
	 	var lights = this.server.getLights();
		if (lights != undefined) {
			lights.forEach(function (light){
			  ro[light.getId()] = light.getState();
		    });
	    } 
 } else {
	var light = this.server.getLight(lightId);
	if (light != undefined) {
		ro[light.getId()] = light.getState();
	} else {
		this.server.error(this.dispatched_request,3,this.name + "/" + lightId ,"resource, " + this.name+"/"+lightId + ", not available" );
		return;
	}
 }
 this.dispatched_request.sendResponse(ro);		
}

module.exports = Service_Lights