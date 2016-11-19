"use strict";

var fs = require('fs');
var debug = require('debug')('Config');
var fs = require('fs');
const chalk = require('chalk');
const log = console.log;
var path = require('path');
var customStoragePath;

var Config = function() {
	this.load();
}

Config.prototype.storagePath = function() {
  if (customStoragePath) return customStoragePath;
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE;
  return path.join(home, ".hm_hue_interface");
}


Config.prototype.load = function(){
	try {
    	var buffer = fs.readFileSync(this.storagePath() + "/config.json");
    	this.settings = JSON.parse(buffer.toString());
    	if (this.settings == undefined) {
	    	this.settings = {};
    	}
	} catch (e) {
	   log(chalk.red("there is no config file at " ,this.storagePath()));
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
	   log(chalk.red("there is no config file at ",this.storagePath()));

	}
}

Config.prototype.getValue = function(key) {
	if (this.settings != undefined) {
		return this.settings[key];
	} else {
		return undefined;
	}
}

Config.prototype.setValue = function(key,value) {
	this.settings[key] = value;
	this.save();
}


module.exports = {
  Config : Config
}
