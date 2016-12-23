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
	this.configuration = Config;
	this.configuration.load();
	this.configServer = new ConfigServer(this.configuration);
	this.homematicChannel = HomematicChannel;
	this.homematicDevice = HomematicDevice;
	this.configuratedPlugins = [];
	this.updateResult;
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
	  		
	  		that.configuratedPlugins.forEach(function (plugin){
		  		if (url.startsWith("/" + plugin.name)) {
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


Server.prototype.dependenciesInitialized = function(dependencies) {
  var result = true;
  var that = this;

  if (dependencies) {
  
  	// uuuuh this is just dirty stuff .. ø\_(. .)_/ø 
  	
	if (typeof dependencies == "string") {
		  dependencies = [dependencies];
  	}
  
	 dependencies.forEach(function (dplugin){
		 that.configuratedPlugins.forEach(function (plugin){
			 if ((plugin.name==dplugin) && (plugin.initialized==false)) {
				 result = false;
			 }
		 });
	 })
  }
  return result;
}




Server.prototype.addDefaultIndexAttributes = function(attributes) {
	
	attributes["haz_update"]=(this.updateResult==-1) ? "(1)":"";
	return attributes;
}

Server.prototype.handleConfigurationRequest = function(dispatched_request) {
	var url = dispatched_request.request.url;
	var that = this;
	
	if (url == "/") {
	  this.updateResult = this.checkUpdate();
	  var pluginString="";
	  this.configuratedPlugins.forEach(function (plugin){
		  logger.debug("Plugin %s With Name %s",plugin,plugin.name);
		  pluginString = pluginString + "<li><a href='/" + plugin.name + "/'>" + plugin.name + "</a></li>";
	  });
	  var cs = 0;
	  var csd = "";
	  var bridge = this.getBridge();
	  if (bridge != undefined) {
		  cs = bridge.listConsumer().length;
	      bridge.listConsumer().forEach(function(consumer){
		      csd = csd + consumer.description() + " | ";
	      });
	  }
	  
	  dispatched_request.dispatchFile(null,"index.html",this.addDefaultIndexAttributes({"plugins":pluginString,"consumer":cs,"consumer_detail":csd}));
	} else 

	switch(url) {
    case "/index/?installmode":
        this.hm_layer.publishAllDevices(function() {
			dispatched_request.dispatchFile(null,"action.html",that.addDefaultIndexAttributes({"message":"all devices published"}));
		});
        break;
     case "/index/?checkupdate":
   	    var update = this.checkUpdate();
   	    var message = "You are up to date";
   	    var link = "#";
   	    
   	    if (update == -1) {
	   	    message = "There is an update available.";
	   	    link="/index/?doupdate";
	   	}
	   	
   	    dispatched_request.dispatchFile(null,"update.html",this.addDefaultIndexAttributes({"message":message,"link":link}));
        break;
        
     case "/index/?doupdate":
   	    var update = this.doUpdate();
   	    dispatched_request.dispatchFile(null,"update.html",this.addDefaultIndexAttributes({"message":update,"link":"#"}));
        break;

    default:
        dispatched_request.dispatchMessage("404 Not found");
    }

}

Server.prototype.isPluginConfigured = function(type) {
	var result = false;
	var that = this;
	var configuredPlugins = this.configuration.getValue("plugins");
	if (configuredPlugins!=undefined) {
    	configuredPlugins.forEach(function (pdef){
	    	if (pdef["type"]==type) {
		    	result = true;
	    	}
    	});
    }
	return result;
}

Server.prototype._loadPlugins = function() {

  var plugins = {};
  var foundOnePlugin = false;
  var that = this;
  
  
  // load and validate plugins - check for valid package.json, etc.
  Plugin.installed().forEach(function(plugin) {


	if (that.isPluginConfigured(plugin.type())) {
		

   // try {
      plugin.load();
   /* }
    catch (err) {
      logger.error("--------------------")
      logger.error("ERROR LOADING PLUGIN " + plugin.type() + ":")
      logger.error(      err.message);
      logger.error(err.stack);
      logger.error("--------------------")
      plugin.loadError = err;
    }

    */
		if (!plugin.loadError) {
			plugins[plugin.type()] = plugin;
			logger.info("Loaded plugin: " + plugin.type());
		}
	}
	
  });
  
	  // Try to find 

  var configuredPlugins = this.configuration.getValue("plugins");
  
  if (configuredPlugins!=undefined) {
      
	  for (var i=0; i<configuredPlugins.length; i++) {

        // Load up the class for this accessory
        var pluginConfig = configuredPlugins[i];
        var pluginType = pluginConfig["type"]; 
        var pluginName = pluginConfig["name"];

    	var plg = plugins[pluginType];
    	  
    	 if (plg!=undefined) {
	       // call the plugin's initializer and pass it the API instance
		   var pluginLogger = new Logger();
		   pluginLogger.prefix = pluginType + " - " + pluginName;
		   var plg_instance = new plg.initializer(this,pluginName,pluginLogger,plg.instance);
		   plg_instance.pluginPath = plg.pluginPath;
		   logger.info(plg_instance.name +" initialized. Document Path is %s Plugin Instance: %s",plg_instance.pluginPath,plg.instance);
		   this.configuratedPlugins.push(plg_instance);
		   plg.instance = plg.instance + 1;
		   foundOnePlugin = true;
    	 }  else {
		   logger.error("No Plugin of type %s was found.",pluginType);	    	 
    	 } 
      }
    }


  // Complain if you don't have any plugins.
  if (!foundOnePlugin) {
    logger.warn("No plugins found. See the README for information on installing plugins.")
  }


  this.configuratedPlugins.filter(function (plugin) { logger.debug("Plugin Name %s",plugin.name);});

  return plugins;
}

Server.prototype.checkUpdate = function() {
    
    var result = -1;
    
    try {	
	var gitUpdate = require('child_process').execSync('git remote update');
	var status = require('child_process').execSync('git status').toString().trim();
	var pos = status.indexOf("up-to-date");

	result = pos;
	} catch (e) {
		result = 0;
	}
	return result;
}

Server.prototype.doUpdate = function() {
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
