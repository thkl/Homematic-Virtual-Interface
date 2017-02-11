//
//  HomematicVirtualPlatform.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 16.01.17.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

function HomematicVirtualPlatform (plugin,name,server,log,instance) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.instance = (instance) ? instance : "0";
	this.config = this.server.configuration;
	this.bridge = server.getBridge();
}

HomematicVirtualPlatform.prototype.myDevices = function() {
	return undefined;
}

HomematicVirtualPlatform.prototype.showSettings = undefined;
HomematicVirtualPlatform.prototype.saveSettings = undefined;

HomematicVirtualPlatform.prototype.shutdown = function() {
	
}

HomematicVirtualPlatform.prototype.restart = function() {
	
}

module.exports = HomematicVirtualPlatform;
