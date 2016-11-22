//
//  Config.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

// static Class

"use strict";

var fs = require('fs');
var path = require('path');
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("Homematic Virtual Interface.Config");

var customStoragePath;
var settings;

function Config () {
	
}

Config.setCustomStoragePath = function(path) {
	customStoragePath = path;
}

Config.storagePath = function() {
  if (customStoragePath) {
	  return customStoragePath;
  }
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
  return path.join(home, ".hm_virtual_interface");
}


Config.load = function(){
	try {
		var configFile = Config.storagePath() + "/config.json";
		logger.info("try to load config : %s",configFile);
    	var buffer = fs.readFileSync(configFile);
    	Config.settings = JSON.parse(buffer.toString());
    	if (Config.settings == undefined) {
	    	Config.settings = {};
    	}
	} catch (e) {
	    logger.warn("There was a problem reading your config.json file (%s).",configFile);
		logger.warn("Please verify your config.json at http://jsonlint.com");
		Config.settings = {};
	}
}

Config.save = function() {

	try {
      var buffer = JSON.stringify(Config.settings);
      fs.writeFile(Config.storagePath() + "/config.json", buffer, function(err) {
	  if(err) {
        debug(err);
    }
	}); 
	
	} catch (e) {
	   logger.error("there is no config file at ",Config.storagePath());

	}
}

Config.getValue = function(key) {
	return Config.getValueWithDefault(key,undefined);
}

Config.getValueWithDefault = function(key,defaultValue) {
	if (Config.settings != undefined) {
		var x = Config.settings[key];
		if (x != undefined) {
			return x
		} else {
			return defaultValue;
		}
	} else {
		return defaultValue;
	}
}

Config.setValue = function(key,value) {
	Config.settings[key] = value;
	Config.save();
}


module.exports = {
  Config : Config
}
