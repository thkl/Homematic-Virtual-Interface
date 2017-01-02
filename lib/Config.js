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
var persist;

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

	try {
		var persistFile = Config.storagePath() + "/persist.json";
		logger.debug("try to load persistent storage : %s",persistFile);
    	var buffer = fs.readFileSync(persistFile);
    	Config.persist = JSON.parse(buffer.toString());
    	if (Config.persist == undefined) {
	    	Config.persist = {};
    	}
	} catch (e) {Config.persist = {};
	  // Copy file
	  fs.createReadStream(Config.storagePath() + "/persist.json").pipe(fs.createWriteStream(Config.storagePath() + "/persist.json.error"));
	  logger.error("Persist File is corrupt. Created a new one -> backup exists.")
	}
}

Config.save = function() {

	try {
      var buffer = JSON.stringify(Config.settings,null, 2);
      fs.writeFile(Config.storagePath() + "/config.json", buffer, function(err) {
	  if(err) {
        debug(err);
    }
	}); 
	
	} catch (e) {
	   logger.error("there is no config file at ",Config.storagePath());

	}
}

Config.savePersistence = function() {

	try {
      var buffer = JSON.stringify(Config.persist,null, 2);
      fs.writeFile(Config.storagePath() + "/persist.json", buffer, function(err) {
	  if(err) {
        logger.error(err);
      }
	}); 
	
	} catch (e) {
	   logger.error("there is no persist file at ",Config.storagePath());
	}
}


Config.getPersistValue = function(key) {
	return Config.getPersistValueWithDefault(key,undefined);
}

Config.getPersistValueForPlugin = function(plugin,key) {
	return Config.getPersistValueWithDefault(plugin + "." + key,undefined);
}

Config.getPersistValueForPluginWithDefault = function(plugin,key,value) {
	return Config.getPersistValueWithDefault(plugin + "." + key,value);
}

Config.getPersistValueWithDefault = function(key,defaultValue) {
	if (Config.persist != undefined) {
		var x = Config.persist[key];
		if (x != undefined) {
			return x
		} else {
			return defaultValue;
		}
	} else {
		return defaultValue;
	}
}


Config.setPersistValueForPlugin = function(plugin,key,value) {
	Config.persist[plugin + "." + key] = value;
	Config.savePersistence();
}

Config.setPersistValue = function(key,value) {
	Config.persist[key] = value;
	Config.savePersistence();
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



Config.getValueForPlugin = function(plugin,key) {
	return Config.getValueForPluginWithDefault(plugin,key,undefined);
}

Config.getSettingsForPlugin = function(aPluginName) {
	
	var configuredPlugins = Config.getValue("plugins");
    if (configuredPlugins!=undefined) {
	      
	  for (var i=0; i<configuredPlugins.length; i++) {
		var pluginConfig = configuredPlugins[i];
        var pluginName = pluginConfig["name"]; 
        if (pluginName == aPluginName) {
	        //logger.debug(JSON.stringify(pluginConfig));
	        return pluginConfig;
        }
	}
	}
	return undefined;
}

Config.getValueForPluginWithDefault = function(plugin,key,defaultValue) {
	if (Config.settings != undefined) {
		var px = Config.getSettingsForPlugin(plugin);
		if (px != undefined) {
			var x = px[key];
			if (x != undefined) {
				return x
			} else {
				return defaultValue;
			}
		} else {
			return defaultValue;
		}
			
			
		} else {
		return defaultValue;
		}
}

Config.setValueForPlugin = function(plugin,key,value) {
	if (Config.settings != undefined) {
		var px = Config.getSettingsForPlugin(plugin);
		if (px != undefined) {
		  px[key] = value;
		}	
	}
	Config.save();
}

module.exports = {
  Config : Config
}
