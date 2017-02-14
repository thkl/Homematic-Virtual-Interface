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
	var that = this
    this.hm_layer = this.server.getBridge()
	this.harmonyServer = new HarmonyHueServer(this)
	this.harmonyClient = new HarmonyClient(this)
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings")
	this.supportedChannels = ["BidCos-RF.SWITCH","BidCos-RF.DIMMER","BidCos-RF.BLIND"]
	this.flobjects = this.loadFakeLights()
}

HarmonyPlatform.prototype.getFakeLightWithId = function(lightId) {
  var result = undefined;
  this.flobjects.forEach(function (flo) {
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


HarmonyPlatform.prototype.updateFakeLight = function(newflo,callback) {
  var that = this;
  this.log.debug("Updating Object %s",JSON.stringify(newflo));
  var nobjects = [];
  this.flobjects.forEach(function (flo) {
	  
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
  })
  
  this.log.debug(JSON.stringify(nobjects))
  this.saveHarmonyObjects(nobjects)
  this.flobjects = this.loadFakeLights()
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
  this.log.debug("Add New Light to existing %s",this.flobjects.length)
  this.flobjects.push(flo);
  this.log.debug("We have now %s",this.flobjects.length)
  this.harmonyServer.addFakeLightDevice(flo);
  this.saveHarmonyObjects(this.flobjects)
}

HarmonyPlatform.prototype.removeFakeLight = function(lightId) {
	var flo = undefined;
	this.flobjects.forEach(function (tmp) {
	 if (tmp["index"] == lightId) {
		 flo = tmp; 
	 }
	});
	if (flo!=undefined) {
    var index = this.flobjects.indexOf(flo);
    if (index > -1) {
	    this.flobjects.splice(index, 1);
		this.harmonyServer.changeFakeLightDevice(lightId,undefined);
		this.saveHarmonyObjects(this.flobjects)
   	} else {
    	this.log.debug("Not Found");
    }
    }
}

HarmonyPlatform.prototype.saveHarmonyObjects = function(objectsToSave,callback) {
     this.config.savePersistentObjektToFile({'harmony_objects':objectsToSave},'harmony_objects',callback);
}

HarmonyPlatform.prototype.loadFakeLights = function() {
	
	var harmony_objects = this.config.loadPersistentObjektfromFile('harmony_objects')
	if ((harmony_objects != undefined) && (harmony_objects['harmony_objects']!=undefined)) {
		return harmony_objects['harmony_objects']
	} else {
		// the old style
		this.log.warn('Fallback to the old storage')
		var strflo = this.config.getPersistValueForPluginWithDefault(this.name,'fakelights',undefined);
		var flo = [] // Fake Light Objects
		if (strflo != undefined) {
			try {
				flo = JSON.parse(strflo);
			} catch (err){}
		} 
		return flo
	} 
}

HarmonyPlatform.prototype.getFakeLights = function() {
	return this.flobjects;
}

HarmonyPlatform.prototype.buildFakeLightList = function(dispatched_request,editId) {

	var fakeLights = "";
	var that = this;
	var lighttemplatefake = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_fake.html",null);
	var lighttemplatefakeEdit = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_fake_edit.html",null);

	
	this.flobjects.some(function (lightdevice) {
			
			var type = undefined
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
						
			if (type != undefined) {
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
			}
	});
	return fakeLights;
}


HarmonyPlatform.prototype.buildCCUObjectList = function(dispatched_request,editId) {

	var fakeLights = "";
	var that = this;
	var lighttemplatefake = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_ccu_object.html",null);
	var lighttemplatefakeEdit = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_ccu_object_edit.html",null);

	
	this.flobjects.some(function (lightdevice) {
			
			var type = undefined

			switch (lightdevice["type"]) {
				case "3": 
				{
					type = "CCU Device";
				}
				break;
				
				case "4": 
				{
					type = "CCU Program";
				}
				break;
				
			}
			var template = lighttemplatefake	
			if (type != undefined) {
			if ((editId != undefined) && (lightdevice["index"] == editId)) {
				template = lighttemplatefakeEdit
			} 
				fakeLights = fakeLights +  dispatched_request.fillTemplate(template,{"lamp_name":lightdevice["name"],
																	  				  "lamp_index":lightdevice["index"],
																					  "hm_device_type":type,
																	  				  "ctype":lightdevice["ctype"],
																					  "adress":lightdevice["adress"] || "Browse"});
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


HarmonyPlatform.prototype.loadCCUDevices = function(callback) {
    var that = this
    var result_list = {}
    var interfaces = ['BidCos-RF']
    
	this.hm_layer.loadCCUDevices(interfaces,function (jobj){
		if (jobj) {
			    that.log.debug(JSON.stringify(jobj.devices));
		    jobj.devices.forEach(function (device){
			    device.channels.forEach(function (channel){
				    var intf = channel.intf;
				    if (that.supportedChannels.indexOf(intf + "." + channel.type)>-1) {
					   var address = channel.address
					   address = address.replace('BidCos-RF.', '')
					   result_list[channel.address] = {"device":device.name,"address":address,"name":channel.name,"type":channel.type}   
				   }
			    })
		    })
	    callback(result_list)
	   }
    })
}

HarmonyPlatform.prototype.loadCCUProgramms = function(callback) {
    var that = this
    var result_list = {}
    this.hm_layer.loadCCUProgramms( function (jobj) {
    	if (jobj) {	
    	jobj.programs.forEach(function (program){
			result_list["P:" + program.id] = {"device":program.name,"address":"P:" + program.id,"name":program.name};   
		})
	    callback(result_list)
		}  
	})
}

HarmonyPlatform.prototype.channelService = function(channelType) {
	return  this.supportedChannels[channelType];
}

HarmonyPlatform.prototype.handleConfigurationRequest = function(dispatchedRequest) {
	var that = this;
	var requesturl = dispatchedRequest.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var realLights = ""; // String of Fake Lights for Output
	var fakeLights = this.buildFakeLightList(dispatchedRequest,undefined); // String of Real Lights for Output
	var ccuObjects = this.buildCCUObjectList(dispatchedRequest,undefined); 
	
	var operation = queryObject["do"];
	if (operation ==undefined) {
		operation = "index";
	}	
	
	
					// Load Lamps
	var lighttemplatereal = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_lamp_real.html",null);
	
	var lightdevices = this.harmonyServer.getLightDevices();
	if (lightdevices!=undefined) {
		lightdevices.forEach(function (lightdevice){
		if (lightdevice.isReal == true) {
			realLights = realLights +  dispatchedRequest.fillTemplate(lighttemplatereal,{"lamp_name":lightdevice.name,"lamp_index":lightdevice.index});
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
				fakeLights = this.buildFakeLightList(dispatchedRequest,lightId); 
			}
		}
		break;
					
	
		case "fake.edit":
		{
			var lightId = queryObject["id"];
			if (lightId!=undefined) {
				this.log.debug("Edit Device %s",lightId);
				fakeLights = this.buildFakeLightList(dispatchedRequest,lightId); 
				ccuObjects = this.buildCCUObjectList(dispatchedRequest,lightId); 
			}

		}
		break;
		
		case "fake.new":
		{
			var lighttemplatefake = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_lamp_fake_edit.html",null);
			fakeLights = fakeLights + dispatchedRequest.fillTemplate(lighttemplatefake,{"lamp_name":"New Device",
																						  "lamp_index":(50 + this.flobjects.length )});

		}
		break;


		case "ccu_object.new":
		{
			var lighttemplatefake = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_lamp_ccu_object_edit.html",null);
			ccuObjects = ccuObjects + dispatchedRequest.fillTemplate(lighttemplatefake,{"lamp_name":"New Device",
																						  "lamp_index":(50 + this.flobjects.length )});

		}
		break;
		
		
		
		case "fake.save":
		{
			var lightId = queryObject['id']
			var name = queryObject['name']
			var type = queryObject['type']
			var adr =  queryObject['device.adress']
			var ctype = queryObject['device.ctype']
			
			that.log.debug('Light with id %s, New DeviceType : %s',lightId,type)

			if ((lightId != undefined) && (name != undefined) && (type != undefined)) {
				var flo = this.getFakeLightWithId(lightId)
				if (flo == undefined) {
				  flo = {};
				  flo['name'] = name
				  flo['type'] = type
				  flo['index'] = lightId
				  if ((type == '3') || (type == '4')) {
					  flo['adress'] = adr
					  flo['ctype'] = ctype || ''
				  }
				  this.addFakeLight(flo)
				} 
				
				else 
				
				{
				  flo['name'] = name
			   	  flo['type'] = type

				  if ((type == '3') || (type == '4')) {
					  flo['adress'] = adr
					  flo['ctype'] = ctype || ''
				  }

				  that.log.debug('udpate %s',JSON.stringify(flo))
				  this.updateFakeLight(flo)
				}
			}
			
			fakeLights = this.buildFakeLightList(dispatchedRequest,undefined)
			ccuObjects = this.buildCCUObjectList(dispatchedRequest,undefined)

		}
		break;	

		case "list.commands":
		{
			
			var list = this.listHarmonyCommands(dispatchedRequest)
			dispatchedRequest.dispatchFile(this.plugin.pluginPath , 'list_actions.html',
																	{'actions':list})
			return;

		}
		break;
		
		case "send.command":
		{
			var cmdName = queryObject['action']
			if (cmdName) {this.harmonyClient.sendAction(cmdName)}
			var list = this.listHarmonyCommands(dispatchedRequest)
			dispatchedRequest.dispatchFile(this.plugin.pluginPath , 'list_actions.html',
																	{'actions':list})
			return;
		}
		break;


		case "device.list":
		{
			this.loadCCUDevices(function (result){
				dispatchedRequest.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify(result)});
			});
			return;
		}
		
		break;
		
		
		case "device.listprograms":
		{
			this.loadCCUProgramms(function (result){
				dispatchedRequest.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify(result)});
			});
			return;
		}
		break;

		case "app.js":
		{
			dispatchedRequest.dispatchFile(this.plugin.pluginPath , "app.js",{});
			return;
		}
		break;
		
		default:
		break;
	}
	
	var activityList = "";
	this.harmonyClient.getActivities().forEach(function (activity){
		activityList = activityList +  dispatchedRequest.fillTemplate(lighttemplatereal,{"lamp_name":activity.label,"lamp_index":activity.chid});
	});
	
	
	dispatchedRequest.dispatchFile(this.plugin.pluginPath , "index.html",{"listRealLights":realLights,
																		  "listFakeLights":fakeLights,
																		  "listCCUObjects":ccuObjects,
																		  "activityList":activityList});
}


module.exports = HarmonyPlatform;
