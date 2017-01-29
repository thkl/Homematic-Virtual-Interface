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
var url = require("url");

var Server = function() {
	logger.debug("Starting up");
	this.configuration = Config;
	this.configuration.load();
	this.configServer = new ConfigServer(this.configuration);
	this.homematicChannel = HomematicChannel;
	this.homematicDevice = HomematicDevice;
	this.configuratedPlugins = [];
	this.updateResult;
	this.myPathHandler=["/","/index/","/settings/"];
}


Server.prototype.init = function() {
	var that = this;
	
	this.localization = require(__dirname + '/Localization.js')(__dirname + "/Localizable.strings");
	this.hm_layer = new HomematicLogicalLayer(this.configuration);
	this.hm_layer.init();
	this.plugins = this._loadPlugins();
	
	this.configServer.on("config_server_http_event" , function (dispatched_request) {
		var requesturl = dispatched_request.request.url;
		var parsed = url.parse(requesturl,true);
		var isMy = that.myPathHandler.indexOf(parsed.pathname.toLowerCase());
		if ((!parsed.pathname) || (isMy>-1)) {
			that.handleConfigurationRequest(dispatched_request);
  		} else {
	  		var handled=false;
	  		
	  		that.configuratedPlugins.forEach(function (plugin){
		  		if (parsed.path.startsWith("/" + plugin.name)) {
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
	
	var requesturl = dispatched_request.request.url;
	var that = this;
	var cfg_handled = false;
	this.localization.setLanguage(dispatched_request);
	var parsed = url.parse(requesturl,true);

	if (parsed.pathname == "/") {
	  
	  // this.updateResult = this.checkUpdate();
	  
	  var pluginString="";
	  var pluginSettings = "";
	  
	  var plugin_settings_template = dispatched_request.getTemplate(null , "plugin_item_ws.html",null);
	  var plugin_no_settings_template = dispatched_request.getTemplate(null , "plugin_item_wos.html",null);
	  
	  this.configuratedPlugins.forEach(function (plugin){
		  pluginString = pluginString + "<li><a href='/" + plugin.name + "/'>" + plugin.name + "</a></li>";
		  var hazSettings = plugin.platform.hasSettings;
		  pluginSettings = pluginSettings + dispatched_request.fillTemplate((hazSettings==true) ? plugin_settings_template:plugin_no_settings_template,
		  														{"plugin.name":plugin.name});
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
	  
	  csd = csd + this.localization.localize("Last Message ") + bridge.lastMessage;
	  
	  dispatched_request.dispatchFile(null,"index.html",this.addDefaultIndexAttributes({"message":"","plugins":pluginString,
		  																							 "pluginSettings":pluginSettings,
		  																							 "consumer":cs,
		  																							 "consumer_detail":csd}));
	  cfg_handled = true;
	} else {

	switch(requesturl) {
		
    case "/index/?installmode":
        this.hm_layer.publishAllDevices(function() {
			dispatched_request.dispatchFile(null,"action.html",that.addDefaultIndexAttributes({"message":that.localization.localize("all devices published")}));
		});
		cfg_handled = true;
        break;

    case "/index/?checkupdate":
   	    var update = this.checkUpdate();
   	    var message = "You are up to date";
   	    var link = "#";
   	    
   	    if (update == -1) {
	   	    message = that.localization.localize("There is an update available.");
	   	    link="/index/?doupdate";
	   	}
	   	
   	    dispatched_request.dispatchFile(null,"update.html",this.addDefaultIndexAttributes({"message":message,"link":link}));
		cfg_handled = true;
        break;
        
    case "/index/?doupdate":
   	    var update = this.doUpdate();
   	    dispatched_request.dispatchFile(null,"update.html",this.addDefaultIndexAttributes({"message":update,"link":"#"}));
		cfg_handled = true;
        break;

	case "/index/?cleanup":
   	    this.hm_layer.cleanUp();
   	    var update = that.localization.localize("All connections removed. Please restart your CCU.");
    	dispatched_request.dispatchFile(null,"index.html",this.addDefaultIndexAttributes({"message":update,"link":"#"}));
		cfg_handled = true;
        break;
	

	}
	
	if (parsed.pathname == "/settings/")
	{
		var result = {};
		if (parsed.query['plugin']!=undefined) {
			that.configuratedPlugins.forEach(function (plugin){
			  if (plugin.name == parsed.query['plugin']) {
				 result["plugin.name"] = plugin.name;
				 var ret = that.handlePluginSettingsRequest(dispatched_request,plugin); 
				 if (ret) {
					 result["editor"] = ret;
				 } else {
				 	 cfg_handled = true;
					 return;
				 }
			  }	
			});
		}
		dispatched_request.dispatchFile(null,"plugin_settings.html",this.addDefaultIndexAttributes(result));
		cfg_handled = true;
	}
		
	if (cfg_handled == false) {
        dispatched_request.dispatchMessage("404 Not found");
    }
   
   }

}

Server.prototype.handlePluginSettingsRequest = function(dispatched_request,plugin) {
  
  var fields = plugin.platform.showSettings();

  if (dispatched_request.post != undefined) {
	  var newSettings = {};
	  var operation = dispatched_request.post["op"];
	  fields.some(function (field){
	  	 newSettings[field.name] = dispatched_request.post[field.name];
	  });
	  plugin.platform.saveSettings(newSettings);
	  dispatched_request.redirectTo("/");
	  return undefined;
  } else {
	  var settings_text_template = dispatched_request.getTemplate(null , "settings_text.html",null);
	  var result = "";
	  fields.some(function (field){
	 
	  switch (field.control) {
		 
		 case "text":
		 {
		 	result = result + dispatched_request.fillTemplate(settings_text_template,{"plugin.name":plugin.name,"control.name":field.name,
			 	"control.value":field.value,"control.label":field.label});
		 	
		 }
	  }
  	});
  
  }
  
  return result;	  
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
		

   //try {
      plugin.load();
		if (!plugin.loadError) {
			plugins[plugin.type()] = plugin;
			logger.info("Loaded plugin: " + plugin.type());
		}
   /*}
    catch (err) {
      logger.error("--------------------")
      logger.error("ERROR LOADING PLUGIN " + plugin.type() + ":")
      logger.error(      err.message);
      logger.error(err.stack);
      logger.error("--------------------")
      plugin.loadError = err;
    }
	}
	*/
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
		return "please Restart ....."
	 } catch (e) {
		return "non git version"
	}
}

module.exports = {
  Server: Server
}
