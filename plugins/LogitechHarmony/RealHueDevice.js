'use strict'

//
//  RealHueDevice.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var RealLight = require(__dirname + '/device/RealLight.js').RealLight;


var RealHueDevice = function (hueserver,data,hue_api) {
	this.hueserver = hueserver;
	this.light;
	this.data = data;
	this.bridge = hueserver.bridge;
	this.log = hueserver.log;
	this.name = data["name"];
	this.index = data["id"];
	this.hue_api = hue_api;
	this.isReal = true;
	this.init();
}	
	
	
RealHueDevice.prototype.init = function() {
  var that = this;
  this.log.debug("Init new RealLight Mapping %s",this.name);
  this.light = new RealLight(this.data,this.log,this.hue_api)
  this.hueserver.addLightDevice(this);
}

module.exports = {
  RealHueDevice : RealHueDevice
}
