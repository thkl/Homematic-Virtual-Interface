//
//  PioneerBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 07.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var avr = require(__dirname + '/pioneer-avr.js');
var PioneerRemote = require(__dirname + '/PioneerRemote.js').Pioneer_Remote;
var path = require('path');
var url = require("url");
var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"../lib";}
var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");


function PioneerPlatform(plugin,name,server,log,instance) {
	PioneerPlatform.super_.apply(this,arguments);
	this.receiver;
	this.mappedDevices= [];
}

util.inherits(PioneerPlatform, HomematicVirtualPlatform);


PioneerPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    var numOfRemotes = this.configuration.getPersistValueForPluginWithDefault(this.name,"numOfRemotes",1);	
    this.log.debug("Init Pioneer Remotes. Number of remotes to use %s",numOfRemotes);
    this.hm_layer = this.server.getBridge();
    
    for(var i = 0; i < numOfRemotes ; i++) { 
    	var avrName = "PioneerAVR" + i;
    	var remote = new PioneerRemote(this);
    	remote.init(avrName,i,this.server.homematicDevice);
    	this.mappedDevices.push(remote);
	}

	setTimeout(function() {that.reconnect()},1000);
}

PioneerPlatform.prototype.clean = function() {
	this.mappedDevices.forEach(function (remote){
		remote.removeFromHMLayer();
	});
	this.mappedDevices= [];
}

PioneerPlatform.prototype.reconnect = function(command) {
	var that = this;
	var hop = this.configuration.getValueForPlugin(this.name,"options");
	if (hop != undefined) {
		var options = {port: hop["port"],host: hop["host"],log: false};
		this.receiver = new avr.VSX(options);
		
		this.receiver.on("connect", function() {
			that.log.info("Connection to the AVR");
		});
		
		this.receiver.on("end", function () {
        	that.log.debug("End ... Reconnecting in 1 second");
			setTimeout(function() {that.reconnect()},1000);
        });
        
        this.receiver.on("error", function () {
        	that.log.debug("Error Reconnecting in 60 seconds");
			setTimeout(function() {that.reconnect()},60000);
        });

    }
}

PioneerPlatform.prototype.sendCommand = function(command) {
 var that = this;
 try {
	this.log.debug("Sending Command %s",command);
	this.receiver.sendCommand(command);
  } catch (err) {that.log.error("Error while sending command %s",err)}
}

PioneerPlatform.prototype.setVolume = function(newVolume) {
 var that = this;
 try {
	this.log.debug("Sending NewVolume %s",newVolume);
	this.receiver.volume(newVolume);
 } catch (err) {that.log.error("Error while sending command %s",err)}
}




PioneerPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	
	
	if (queryObject["do"]!=undefined) {
	
		this.log.debug("Config Command is %s",queryObject["do"]);	
		switch (queryObject["do"]) {
		
			case "settings.save":
			{
				var numofremotes = queryObject["settings.numberOfRemotes"];
				this.log.debug("Set new Number of Remotes %s",numofremotes);
				this.configuration.setPersistValueForPlugin(this.name,"numOfRemotes",numofremotes); 
				this.clean();
				this.init();
			}
			break;
	    }
	}
	
	var numOfRemotes = this.configuration.getPersistValueForPluginWithDefault(this.name,"numOfRemotes",1); 
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"settings.numberOfRemotes":numOfRemotes});
}


module.exports = PioneerPlatform;