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

HomematicVirtualPlatform.prototype.getName = function() {
  return this.name;
}

HomematicVirtualPlatform.prototype.restart = function() {
	
}


HomematicVirtualPlatform.prototype.getPluginVersion = function() {
  var pjPath = path.join(__dirname, './package.json');
  var pj = JSON.parse(fs.readFileSync(pjPath));
  return pj.version;
}  

module.exports = HomematicVirtualPlatform;
