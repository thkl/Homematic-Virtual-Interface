//
//  HarmonyPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var path = require('path');
var url = require("url");
var HarmonyHueServer = require(__dirname + '/HarmonyHueServer.js').HarmonyHueServer;
var HarmonyClient = require(__dirname + '/HarmonyClient.js').HarmonyClient;
var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");


function HarmonyPlatform(plugin,name,server,log,instance) {
	HarmonyPlatform.super_.apply(this,arguments);
}

util.inherits(HarmonyPlatform, HomematicVirtualPlatform);


HarmonyPlatform.prototype.init = function() {
	var that = this;
	this.hasSettings = true;
    this.hm_layer = this.server.getBridge();
	this.harmonyServer = new HarmonyHueServer(this);
	this.harmonyClient = new HarmonyClient(this);
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");
}

HarmonyPlatform.prototype.getFakeLightWithId = function(lightId) {
  var result = undefined;
  var flobjects = this.getFakeLights();
  flobjects.forEach(function (flo) {
	 if (flo["index"] == lightId) {
		 result = flo; 
	 }
  });
  return result;
}

HarmonyPlatform.prototype.shutdown = function() {
	this.log.debug("Harmony Plugin Shutdown");
	this.harmonyServer.shutdown();
}


HarmonyPlatform.prototype.updateFakeLight = function(newflo) {
  var that = this;
  this.log.debug("Updating Object %s",JSON.stringify(newflo));
  var nobjects = [];
  var flobjects = this.getFakeLights();
  flobjects.forEach(function (flo) {
	 if (flo["index"] == newflo["index"]) {
		 that.log.debug("Found and Change");
		 // If there is a new Type -> we have to do a ccu change
		 if (flo["type"] != newflo["type"]) {
			that.harmonyServer.changeFakeLightDevice(flo["index"],newflo);			 
		 }
		 nobjects.push(newflo); 
	 } else {
		 nobjects.push(flo);
	 }
  });
  this.log.debug(JSON.stringify(nobjects));
  this.config.setPersistValueForPlugin(this.name,"fakelights",JSON.stringify(nobjects));
}
HarmonyPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request);
	var result = [];
	
	var localPort = this.config.getValueForPluginWithDefault(this.name,"port",7000);
    var localHostIP = this.config.getValueForPluginWithDefault(this.name,"host",this.hm_layer.getIPAddress());
	var hub_ip = this.config.getValueForPluginWithDefault(this.name,"hub_ip","");
	var hue_plugin_name = this.config.getValueForPluginWithDefault(this.name,"hue_plugin_name","");
 	
	result.push({"control":"text","name":"hub_ip","label":this.localization.localize("Harmony Hub IP"),"value":hub_ip,"size":20});

	result.push({"control":"text","name":"localHostIP","label":this.localization.localize("Local Host IP (if not the first Interface)"),"value":localHostIP,"size":20});

	
	result.push({"control":"text",
					"name":"localPort",
				   "label":this.localization.localize("Local Port"),
				   "value":localPort,
		     "description":this.localization.localize("If you want to change the local port from 7000")
	});

	result.push({"control":"text",
					"name":"hue_plugin_name",
				   "label":this.localization.localize("Hue Plugin Name (optional)"),
				   "value":hue_plugin_name,
		     "description":this.localization.localize("If you want to use a normal hue bridge.")
	});
	
	return result;
}

HarmonyPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var hub_ip = settings.hub_ip;
	var localHostIP = settings.localHostIP;
	var localPort = settings.localPort;
	var hue_plugin_name = settings.hue_plugin_name;

	if  (hub_ip) {
		this.config.setValueForPlugin(this.name,"hub_ip",hub_ip); 
	} 

	if (localHostIP) {
		this.config.setValueForPlugin(this.name,"host",localHostIP); 
	}
	
	if (localPort) {
		this.config.setValueForPlugin(this.name,"port",localPort); 
	}
	
	if (hue_plugin_name) {
		this.config.setValueForPlugin(this.name,"hue_plugin_name",hue_plugin_name); 
	} else {
		this.config.setValueForPlugin(this.name,"hue_plugin_name",""); 
	}
	
	this.shutdown();
	this.harmonyServer = new HarmonyHueServer(this);
	this.harmonyClient = new HarmonyClient(this);
}



HarmonyPlatform.prototype.myDevices = function() {
	return this.harmonyClient.myDevices();
}


HarmonyPlatform.prototype.sendClientAction = function(actionname) {
	return this.harmonyClient.do_sendRawAction(actionname);
}

HarmonyPlatform.prototype.addFakeLight = function(flo) {
  var flobjects = this.getFakeLights();
  this.log.debug("Add New Light to existing %s",flobjects.length)
  flobjects.push(flo);
  this.log.debug("We have now %s",flobjects.length)
  this.config.setPersistValueForPlugin(this.name,"fakelights",JSON.stringify(flobjects));
  this.harmonyServer.addFakeLightDevice(flo);
}

HarmonyPlatform.prototype.removeFakeLight = function(lightId) {
    var flobjects = this.getFakeLights();
	var flo = undefined;
	flobjects.forEach(function (tmp) {
	 if (tmp["index"] == lightId) {
		 flo = tmp; 
	 }
	});
	if (flo!=undefined) {
    var index = flobjects.indexOf(flo);
    if (index > -1) {
	    flobjects.splice(index, 1);
		this.config.setPersistValueForPlugin(this.name,"fakelights",JSON.stringify(flobjects));
		this.harmonyServer.changeFakeLightDevice(lightId,undefined);
   	} else {
    	this.log.debug("Not Found");
    }
    }
}


HarmonyPlatform.prototype.getFakeLights = function() {
	var flo = []; // Fake Light Objects
	var strflo = this.config.getPersistValueForPluginWithDefault(this.name,"fakelights",undefined);
	
	if (strflo != undefined) {
		try {
			flo = JSON.parse(strflo);
		} catch (err){}
	} 
	return flo;
}

HarmonyPlatform.prototype.buildFakeLightList = function(dispatched_request,editId) {

	var fakeLights = "";
	var flobjects = this.getFakeLights();
	var that = this;
	var lighttemplatefake = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_fake.html",null);
	var lighttemplatefakeEdit = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_fake_edit.html",null);

	
	flobjects.forEach(function (lightdevice) {
			
			var type = "unknow";
			var dimmer_select;
			var switch_select;
			switch (lightdevice["type"]) {
				case "0": 
				{
					type = "HM-LC-Sw";
					dimmer_select = "";
					switch_select = "selected=selected";
				}
				break;
				
				case "1": 
				{
					type = "HM-LC-Dim";
					dimmer_select = "selected=selected";
					switch_select = "";
				}
				break;
				
			}
						
			
			if ((editId != undefined) && (lightdevice["index"] == editId)) {
				
		 
				
				fakeLights = fakeLights +  dispatched_request.fillTemplate(lighttemplatefakeEdit,{"lamp_name":lightdevice["name"],
																		  				  "lamp_index":lightdevice["index"],
																						  "hm_device_type":type,
																						  "dimmer_select":dimmer_select,
																						  "switch_select":switch_select});

			} else {
				fakeLights = fakeLights +  dispatched_request.fillTemplate(lighttemplatefake,{"lamp_name":lightdevice["name"],
																		  				  "lamp_index":lightdevice["index"],
																						  "hm_device_type":type});
			}
			

	});
	return fakeLights;
}

HarmonyPlatform.prototype.listHarmonyCommands = function(dispatched_request) {
	var result = this.harmonyClient.listActions();
	var list = "";
	var atmp = dispatched_request.getTemplate(this.plugin.pluginPath , "list_tmp_action.html",null);

	result.some(function (action){
		list = list + dispatched_request.fillTemplate(atmp,{"action":action});
	});
	return list;
}

HarmonyPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var that = this;
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var realLights = ""; // String of Fake Lights for Output
	var fakeLights = this.buildFakeLightList(dispatched_request,undefined); // String of Real Lights for Output
	
	var operation = queryObject["do"];
	if (operation ==undefined) {
		operation = "index";
	}	
	
	
					// Load Lamps
	var lighttemplatereal = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_real.html",null);
	
	var lightdevices = this.harmonyServer.getLightDevices();
	if (lightdevices!=undefined) {
		lightdevices.forEach(function (lightdevice){
		if (lightdevice.isReal == true) {
			realLights = realLights +  dispatched_request.fillTemplate(lighttemplatereal,{"lamp_name":lightdevice.name,"lamp_index":lightdevice.index});
		}
		});
	}		

	
	
	switch (operation) {
			
		case "pairing":
		{
			this.harmonyServer.activateLinkMode();
		}
		break;
			
			
		case "fake.delete":
		{
			
			var lightId = queryObject["id"];
			if (lightId!=undefined) {
				this.log.debug("Remove Device %s",lightId);
				this.removeFakeLight(lightId);
				fakeLights = this.buildFakeLightList(dispatched_request,lightId); 
			}
		}
		break;
					
	
		case "fake.edit":
		{
			var lightId = queryObject["id"];
			if (lightId!=undefined) {
				this.log.debug("Edit Device %s",lightId);
				fakeLights = this.buildFakeLightList(dispatched_request,lightId); 
			}

		}
		break;
		
		case "fake.new":
		{
			var lighttemplatefake = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_fake_edit.html",null);
			fakeLights = fakeLights +  dispatched_request.fillTemplate(lighttemplatefake,{"lamp_name":"New Device",
																						  "lamp_index":(50 + this.getFakeLights().length )});

		}
		break;
		
		
		
		case "fake.save":
		{
			var lightId = queryObject["id"];
			var name = queryObject["name"];
			var type = queryObject["type"];
			that.log.debug("New DeviceType : %s",type);

			if ((lightId!=undefined) && (name!=undefined) && (type!=undefined)) {
				var flo = this.getFakeLightWithId(lightId);
				if (flo==undefined) {
				  flo = {};
				  flo["name"] = name;
				  flo["type"] = type;
				  flo["index"] = lightId;	
				  this.addFakeLight(flo);
				} else {
				  flo["name"] = name;
			   	  flo["type"] = type;
				  this.updateFakeLight(flo);
				}
			}
			fakeLights = this.buildFakeLightList(dispatched_request,undefined);	
		}
		break;	

		case "list.commands":
		{
			
			var list = this.listHarmonyCommands(dispatched_request);
			dispatched_request.dispatchFile(this.plugin.pluginPath , "list_actions.html",
																	{"actions":list});
			return;

		}
		break;
		
		case "send.command":
		{
			var cmdName = queryObject["action"];
			if (cmdName) {this.harmonyClient.sendAction(cmdName);}
			var list = this.listHarmonyCommands(dispatched_request);
			dispatched_request.dispatchFile(this.plugin.pluginPath , "list_actions.html",
																	{"actions":list});
			return;
		}
		break;

		default:
		break;
	}
	
	var activityList = "";
	this.harmonyClient.getActivities().forEach(function (activity){
		activityList = activityList +  dispatched_request.fillTemplate(lighttemplatereal,{"lamp_name":activity.label,"lamp_index":activity.chid});
	});
	
	
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listRealLights":realLights,"listFakeLights":fakeLights,"activityList":activityList});
}


module.exports = HarmonyPlatform;
