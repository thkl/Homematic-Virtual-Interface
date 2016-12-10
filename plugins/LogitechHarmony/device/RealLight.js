
//
//  RealLight.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";
const EventEmitter = require('events');
const util = require('util');

var RealLight = function(data,log,api) {
	this.id = data["id"];
	this.data = data;
	this.log = log;
	this.fake = false;
	this.api = api;
	EventEmitter.call(this);
}

util.inherits(RealLight, EventEmitter);

RealLight.prototype.getId = function() {
 return this.id;
}

RealLight.prototype.getState = function() {

	this.log.debug("Build RealLight State for %s state : %s",this.data["uniqueid"],this.data["state"]["on"]);
	return this.data;
}


RealLight.prototype.sendStates = function (newState) {
	var that = this;
	this.log.debug("Send States %s",JSON.stringify(newState));
	this.api.setLightState(this.id,newState, function(err, result) {
		// ToDo Update the State from Result;
		that.api.lightStatus(that.id, function(err, result) {
			if (result["state"]!=undefined) {
				that.data["state"] = result["state"];
				that.log.debug("Build RealLight State for %s state : %s",that.data["uniqueid"],that.data["state"]["on"]);
			}
		});
	});
}

module.exports = {
  RealLight : RealLight
}
