
//
//  Fakelight.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";
const EventEmitter = require('events');
const util = require('util');

var Fakelight = function(log,id,name,isOn) {
	this.id = id;
	this.bri = -1;
	this.hue = 0;
	this.sat = 0;
	this.isOn = isOn;
	this.effect = "none";
	this.alert = "lselect";
	this.name = name;
	this.type = "Color light";
	this.modelid = "LLC006";
	this.uniqueid = "1234_" +  this.id ;
	this.log = log;
	this.fake = true;
	EventEmitter.call(this);
}

util.inherits(Fakelight, EventEmitter);

Fakelight.prototype.getId = function() {
 return this.id;
}

Fakelight.prototype.getState = function() {

	this.log.debug("Build Fakelight State for %s state : %s",this.uniqueid,this.isOn);

	var result = {}
	var state = {};
	
	state["on"] = this.isOn;
	state["bri"]=this.bri;
	state["hue"]=this.hue;
	state["sat"]=this.sat;
	state["effect"]=this.effect;

	
	result["state"] = state;
	
	result["xy"] = [0,0];
	result["alert"] = this.alert;
	result["colormode"] = "hs";
	result["reachable"] = true;
	result["type"] = this.type;
	result["name"] = this.name;
	result["modelid"] = this.modelid ;
	result["manufacturername"] = "ksquare.de";
	result["uniqueid"] = this.uniqueid;
	result["swversion"] = "0.0.1";

	return result;
}

Fakelight.prototype.setOn = function (state) {
	
   if (this.isOn != state) {
	   this.emit("harmony_device_value_change", this.id , "on",state);
	   // If we turn the light back on we have to send the brightness again
	   if (state == true) {
		   this.emit("harmony_device_value_change", this.id , "bri",this.bri);
	   }
	   this.isOn = state;
	   this.log.debug("Set isOn for Light %s to %s",this.uniqueid , this.isOn);
   }	
}

Fakelight.prototype.setBrightness = function (brightness) {
	//  Check if we have new State and make a call if
	   this.log.debug("Set brightness command",this.uniqueid ,brightness);
	
   if (this.bri != brightness) {
	   this.emit("harmony_device_value_change", this.id , "bri",brightness);
	   this.bri = brightness;
	   this.log.debug("Set brightness for Light %s to %s",this.uniqueid , this.bri);
   } else {
	   this.log.debug("not changed")
   }	
}

module.exports = {
  Fakelight : Fakelight
}
