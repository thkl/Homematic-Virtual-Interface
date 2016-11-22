//
//  Server.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

"use strict";


var HomematicLogicalLayer = require(__dirname + "/HomematicLogicLayer.js").HomematicLogicalLayer;
var Config = require(__dirname + '/Config.js').Config;
var ConfigServer = require(__dirname + '/ConfigurationServer.js').ConfigurationServer;
var Plugin = require(__dirname + '/VirtualDevicePlugin.js').VirtualDevicePlugin;
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("Homematic Virtual Interface.Server");

var HomematicChannel = require(__dirname + "/HomematicChannel.js").HomematicChannel;
var HomematicDevice = require(__dirname + "/HomematicDevice.js").HomematicDevice;
var fs = require('fs');

var Server = function() {
	logger.debug("Starting up");
	this.configuration = new Config();
	this.configServer = new ConfigServer(this.configuration);
	this.homematicChannel = HomematicChannel;
	this.homematicDevice = HomematicDevice;
}


Server.prototype.init = function() {
	var that = this;
	this.hm_layer = new HomematicLogicalLayer(this.configuration);
	this.hm_layer.init();
	this.plugins = this._loadPlugins();
	
	this.configServer.on("config_server_http_event" , function (dispatched_request) {
		var url = dispatched_request.request.url;
		if ((url=="/") || (url.startsWith("/index/"))) {
			that.handleConfigurationRequest(dispatched_request);
  		} else {
	  		var handled=false;
	  		var keys = Object.keys(that.plugins);
	  		keys.map(function (pluginName){
		  	  var plugin = that.plugins[pluginName];
		  		if (url.startsWith("/" + pluginName)) {
			  	   plugin.handleConfigurationRequest(dispatched_request);
		  	  	   handled = true;
		  	  } 
		  	});
		  	
		  	if (handled == false) {
		  		dispatched_request.dispatchFile(null,dispatched_request.request.url);
		  	}
  		}
	});
}

Server.prototype.shutdown = function() {
	this.getConfigurationServer().shutdown();
	this.getBridge().shutdown();
}

Server.prototype.getBridge = function() {
  return this.hm_layer;
}

Server.prototype.getConfigurationServer = function() {
  return this.configServer;
}



Server.prototype.handleConfigurationRequest = function(dispatched_request) {
	var url = dispatched_request.request.url;
	var that = this;
	
	if (url == "/") {

	  var pluginList = Object.keys(this.plugins);
	  var pluginString="";
	  pluginList.map(function(pluginName){
		  pluginString = pluginString + "<li><a href='/" + pluginName + "'>" + pluginName + "</a></li>";
	  });

	  dispatched_request.dispatchFile(null,"index.html",{"plugins":pluginString});
	} else 

	switch(url) {
    case "/index/?installmode":
        this.hm_layer.sendRPCMessage("newDevices",this.hm_layer.getMyDevices(), function(error, value) {
			dispatched_request.dispatchFile(null,"action.html",{"message":"all devices published"});
		});
        break;
     case "/index/?checkupdate":
   	    var update = this.checkUpdate();
   	    var message = "You are up to date";
   	    var link = "#";
   	    
   	    switch (update) {
   	      case 0:
   	      break
   	      case 1:
	   	    message = "There is an update available.";
	   	    link="/index/?doupdate";
	   		break;
   	      case -1:
   	        message = "No git version.";
   	        break;
   	     }

   	    dispatched_request.dispatchFile(null,"update.html",{"message":message,"link":link});
        break;
        
     case "/index/?doupdate":
   	    var update = this.doUpdate();
   	    dispatched_request.dispatchFile(null,"update.html",{"message":update,"link":"#"});
        break;

    default:
        dispatched_request.dispatchMessage("404 Not found");
    }

}

Server.prototype._loadPlugins = function() {

  var plugins = {};
  var foundOnePlugin = false;
  // load and validate plugins - check for valid package.json, etc.
  Plugin.installed().forEach(function(plugin) {

    // attempt to load it
    try {
      plugin.load();
    }
    catch (err) {
      logger.error("--------------------")
      logger.error("ERROR LOADING PLUGIN " + plugin.name() + ":")
      logger.error(err.stack);
      logger.error("--------------------")
      plugin.loadError = err;
    }

    if (!plugin.loadError) {

      // add it to our dict for easy lookup later
      plugins[plugin.name()] = plugin;

      logger.info("Loaded plugin: " + plugin.name());

      // call the plugin's initializer and pass it the API instance
      var pluginLogger = new Logger();
      plugin.initializer(this,pluginLogger);
      
      logger.info(plugin.name() + " initialized.");
      foundOnePlugin = true;
    }

  }.bind(this));

  // Complain if you don't have any plugins.
  if (!foundOnePlugin) {
    logger.warn("No plugins found. See the README for information on installing plugins.")
  }

  return plugins;
}

Server.prototype.checkUpdate = function() {
    try {	
	require('child_process').execSync('git remote update')
	var revision = require('child_process').execSync('git rev-parse HEAD').toString().trim()
	var remote = require('child_process').execSync('git rev-parse @{u}').toString().trim()
	logger.debug("Local %s vs remote %s",revision,remote)
	if (revision == remote) {
		return 0;
	} else {
		return 1;
	}
	 } catch (e) {
		return -1;
	}
}

Server.prototype.checkUpdate = function() {
    try {	
	require('child_process').execSync('git pull')
		return "Please restart the Server."
	 } catch (e) {
		return "non git version"
	}
}

module.exports = {
  Server: Server
}
