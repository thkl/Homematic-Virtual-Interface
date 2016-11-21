//
//  Config.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//



"use strict";

var fs = require('fs');
var path = require('path');
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("Homematic Virtual Interface.Config");

var customStoragePath;

var Config = function() {
	this.load();
}

Config.prototype.storagePath = function() {
  if (customStoragePath) return customStoragePath;
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
  return path.join(home, ".hm_virtual_interface");
}


Config.prototype.load = function(){
	try {
		var configFile = this.storagePath() + "/config.json";
    	var buffer = fs.readFileSync(configFile);
    	this.settings = JSON.parse(buffer.toString());
    	if (this.settings == undefined) {
	    	this.settings = {};
    	}
	} catch (e) {
	    logger.warn("There was a problem reading your config.json file (%s).",configFile);
		logger.warn("Please verify your config.json at http://jsonlint.com");
		this.settings = {};
	}
}

Config.prototype.save = function() {

	try {
      var buffer = JSON.stringify(this.settings);
      fs.writeFile(this.storagePath() + "/config.json", buffer, function(err) {
	  if(err) {
        debug(err);
    }
	}); 
	
	} catch (e) {
	   logger.error("there is no config file at ",this.storagePath());

	}
}

Config.prototype.getValue = function(key) {
	return this.getValueWithDefault(key,undefined);
}

Config.prototype.getValueWithDefault = function(key,defaultValue) {
	if (this.settings != undefined) {
		var x = this.settings[key];
		if (x != undefined) {
			return x
		} else {
			return defaultValue;
		}
	} else {
		return defaultValue;
	}
}

Config.prototype.setValue = function(key,value) {
	this.settings[key] = value;
	this.save();
}


module.exports = {
  Config : Config
}
