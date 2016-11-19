"use strict";

var fs = require('fs');
var debug = require('debug')('Config');

var Config = function() {
	this.load();
}


Config.prototype.load = function(){
	try {
    	var buffer = fs.readFileSync("config.json");
    	this.settings = JSON.parse(buffer.toString());
	} catch (e) {

	}
}

Config.prototype.save = function() {

	try {
      var buffer = JSON.stringify(this.settings);
      fs.writeFile("config.json", buffer, function(err) {
	  if(err) {
        debug(err);
    }
	}); 
	
	} catch (e) {

	}
}

Config.prototype.getValue = function(key) {
	return this.settings[key];
}

Config.prototype.setValue = function(key,value) {
	this.settings[key] = value;
	this.save();
}


module.exports = {
  Config : Config
}
