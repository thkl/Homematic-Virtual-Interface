//
//  HueBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HueApi = require("node-hue-api").HueApi;
var url = require("url");
var HueColorDevice = require(__dirname + "/HueColorDevice.js").HueColorDevice;
var HueDimmableDevice = require(__dirname + "/HueDimmableDevice.js").HueDimmableDevice;

var HueDeviceOsramPlug = require(__dirname + "/HueDeviceOsramPlug.js").HueDeviceOsramPlug;
var HueSceneManager = require(__dirname + "/HueSceneManager.js").HueSceneManager;
var HueGroupManager = require(__dirname + "/HueGroupManager.js").HueGroupManager;
var HueEffectServer = require(__dirname + "/HueEffectServer.js").HueEffectServer;
var HueSFXDevice = require(__dirname + "/HueSFXDevice.js").HueSFXDevice;

var HueBridge = function(plugin,name,server,log,instance) {
	this.plugin = plugin;
	this.mappedDevices = [];
	this.hue_ipAdress;
	this.hue_userName;
	this.hue_api;
	this.server = server;
	this.log = log;
	this.lights = [];
	this.groups = [];
	this.name = name;
	this.instance = instance;
	this.effectServers={};
	this.sfxDevice;
}


HueBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	
	this.log.info("Init %s",this.name);
	var ip = this.configuration.getValueForPlugin(this.name,"hue_bridge_ip");
	
	if ((ip!=undefined) && (ip!="")) {
	    this.hue_ipAdress = ip;
		this.log.info("Hue Bridge Init at %s with instance %s",this.hue_ipAdress , this.instance);

	if (this.checkUsername()==true) {
	    this.queryBridgeAndMapDevices()
    }

} else {
	
	this.locateBridge( function (err) {
        if (err) throw err;
		if (that.hue_ipAdress != undefined) {
	        that.configuration.setValueForPlugin(that.name,"hue_bridge_ip",that.hue_ipAdress); 
			that.log.info("Saved the Philips Hue bridge ip address "+ that.hue_ipAdress +" to your config to skip discovery.");
			if (that.checkUsername()==true) {
	        	that.queryBridgeAndMapDevices()
			}
		} else {
	        that.log.error("No bridges this did not make sense .. giving up");
		}

     });
}
}


HueBridge.prototype.locateBridge = function (callback) {
	var that = this;
	this.log.info("trying to find your Hue bridge ...");
	var hue = require("node-hue-api");
	
	hue.upnpSearch(6000).then(function (bridges) {
		if ((bridges != undefined) && (bridges.length > 0)) {
		  that.log.info("Scan complete",bridges[0].ipaddress);
          that.hue_ipAdress = bridges[0].ipaddress;
          callback(null,undefined);
		} else {
          that.log.warn("Scan complete but no bridges found");
          callback(null,null);
		}
    }).done();
    
}


HueBridge.prototype.checkUsername = function() {
   var that = this;
   var user = this.configuration.getValueForPlugin(this.name,"hue_username")
   if ((user==undefined) || (user=="")) {
       this.log.info("trying to create a new user at your bridge");
	   var api = new HueApi(that.hue_ipAdress);
        api.createUser(that.hue_ipAdress,function(err, user) {
          // try and help explain this particular error
          
          if (err && err.message == "link button not pressed") {
            that.log.warn("Please press the link button on your Philips Hue bridge within 30 seconds.");
            setTimeout(function() {that.checkUsername();}, 10000);
          } else {
	        that.configuration.setValueForPlugin(that.name,"hue_username",user); 
            that.log.info("saved your user to config.json");
            that.hue_userName = user;
            return true;
          }
        });
   } else {
     that.hue_userName = user;
	 return true;   
   }
}


// Make a connection to the HUE Bridge... if there are no credentials .. try to find a bridge

	
HueBridge.prototype.queryBridgeAndMapDevices = function() {
var that = this;
this.hue_api = new HueApi(this.hue_ipAdress,this.hue_userName);

this.sceneManager = new HueSceneManager(this,this.hue_api,this.instance);
this.groupManager = new HueGroupManager(this,this.hue_api,this.instance);
// --------------------------
// Fetch Lights
this.queryLights();
// Fetch the Groups
this.queryGroups();
// Fetch all Scenes
this.queryScenes();

setTimeout(function() {that.checkReady();}, 1);
}

HueBridge.prototype.setupEffectServer = function() {
	var that = this;
	this.effectServers = {};
	var count=0;
	var efs = this.getConfiguredEffectServer();
	efs.forEach(function (definition){
		var name = definition["name"];
		var lights = definition["lights"];
		var efserver = new HueEffectServer(name);
		
		lights.forEach(function (lightid){
			that.log.debug("Try adding light with ID %s",lightid)
			var lightObject = that.lightWithId(lightid);
			if (lightObject) {
				efserver.addLight(lightObject);
			} else {
				that.log.error("Light with ID %s not found",lightid);
			}
		});
		count=count+1;
		that.effectServers[name] = efserver;
  	});
  	
  	// Create a HM Device if we had one EFXs
  	if (count > 0) {
  		this.sfxDevice = new HueSFXDevice(this);
  		this.sfxDevice.setServerList(that.effectServers);
  	}
}

HueBridge.prototype.checkReady = function() {
  var that = this;
  if ((this.lightsInitialized) && (this.groupsInitialized) && (this.scenesInitialized)) {
  	 this.plugin.initialized = true;
	 this.log.info("initialization completed");
	 this.refreshAll();
  } else {
	 setTimeout(function() {that.checkReady();}, 1000);
  }	
}


HueBridge.prototype.queryLights = function() {
	var that = this;
	this.hue_api.lights(function(err, lights) {
	
	if ((lights != undefined) && (lights["lights"]!=undefined)) {
  		lights["lights"].forEach(function (light) {
    		
    		switch (light["type"]) {
	    		
    		 case "On/Off plug-in unit": {
    			that.log.debug("Create new Osram Plug " + light["name"]);
    			var devName = "OSRPLG" +  that.instance;
				var hd = new HueDeviceOsramPlug(that,that.hue_api,light,devName);
				light["hm_device_name"] = devName + light["id"];
    		  } 
     		  break;
     		  
     		  case "Extended color light": 
    		  case "Color light": {
	    		that.log.debug("Create new Color Light " + light["name"]);
	    		// Try to load device
	    		var devName = "HUE000" +  that.instance;
				var hd = new HueColorDevice(that,that.hue_api,light,devName);
				light["hm_device_name"] = devName + light["id"];
    		  }
    		  break;
    		   
    		  case "Dimmable light": {
	    		that.log.debug("Create new White Light " + light["name"]);
	    		// Try to load device
	    		var devName = "HUE000" +  that.instance;
				var hd = new HueDimmableDevice(that,that.hue_api,light,devName);
				light["hm_device_name"] = devName + light["id"];
    		  }
    		  break;
    		  
    		  default:
			  	that.log.error("Sorry there is currently no mapping for %s please create an issue at github for that. Thank you.",light["type"]);
			  	break;
    		 } 
    		
    		
    		
    		that.lights.push(light);
    		that.mappedDevices.push(hd);
  		});
  	that.log.debug("Lightinit completed with " + that.lights.length + " devices mapped.");
  	that.lightsInitialized = true;
  	
  	
  	// Setup All EffectServer
  	that.setupEffectServer();

  	}
	});
}


HueBridge.prototype.queryGroups = function() {
	var that = this;
	this.hue_api.groups(function(err, groups) {
	
	if (groups != undefined) {
		groups.forEach(function (group) {
			that.groupManager.addGroup(group);	
     	});
  	}  
  	
  	that.log.debug("Group loading completed. Will publish groups now .. (if there are some)");
  	var publishedgroups = that.getConfiguredGroups();
	
	if (publishedgroups != undefined) {
		that.log.debug("Found some groups to publish ...");
	  	that.groupManager.publish(publishedgroups,false);
	  	that.log.debug("Aaaand i am done");
  	}

  	if (publishedgroups) {
	  	that.log.debug("Groupinit completed with " + publishedgroups.length + " devices mapped.");
  	} else {
	  	that.log.debut("No groups ...set init to completed.");
  	}
	
	that.groupsInitialized = true;
  	
	});
}

HueBridge.prototype.queryScenes = function() {
	var that = this;
	var scnt = 0;
	this.hue_api.getScenes(function(err, scenes) {
		scenes.forEach(function (scene) {
			if (scene["owner"] != "none") {
				scnt = scnt + 1;
				that.sceneManager.addScene(scene);
			}
		});

		var publishedscenes = that.getConfiguredScenes();	
		if (publishedscenes != undefined) {
	  		that.sceneManager.publish(publishedscenes,false);
  		}
  	
  	if (publishedscenes) {
  		that.log.debug("Sceneinit completed with "+ publishedscenes.length +" scenes mapped.");
  	}else {
	  	that.log.debut("No scenes ...set init to completed.");
  	}
	that.scenesInitialized = true;
	});
}

HueBridge.prototype.getConfiguredGroups = function() {
	var ps = this.configuration.getPersistValueForPluginWithDefault(this.name,"PublishedGroups",undefined);
	if (ps != undefined) {
		try{
			return JSON.parse(ps);
		} catch (err) {
			this.log.warn("persistent group definition is broken. ignore that one.");
			this.configuration.setPersistValueForPlugin(this.name,"PublishedGroups","[]");
			return [];
		}
	}
	return [];	
} 


HueBridge.prototype.lightWithId = function(lightId) {
	return this.mappedDevices.filter(function (light) { return light.lightId == lightId}).pop();
} 

HueBridge.prototype.saveConfiguredGroups = function(publishedgroups) {
	var s = JSON.stringify(publishedgroups);
	this.configuration.setPersistValueForPlugin(this.name,"PublishedGroups",s);
} 

HueBridge.prototype.refreshAll = function() {
	var that = this;
	this.log.debug("Refreshing Lamp status ...");
	var refreshrate = this.configuration.getValueForPluginWithDefault(this.plugin.name,"refresh",60)*1000;
	
	this.hue_api.lights(function(err, lights) {
		that.log.debug("Number of Lamps in update %s error %s -> %s",lights,err);
		if (err) {
			that.log.debug(err.stack);
		}
		if (lights) {
	 	lights["lights"].forEach(function (light) {
		  var hue_light = that.lightWithId(light["id"]);
		  if (hue_light) {
			  that.log.debug("Processing response for Lamp %s",light["id"]);
			  hue_light.refreshWithData(light);
		  }
		});
		}
	});
	
	setTimeout(function() {
		 	that.refreshAll();
	}, refreshrate);
	this.log.debug("Refreshed Lights Next in %s ms.",refreshrate);

} 

HueBridge.prototype.getConfiguredScenes = function() {
	var ps = this.configuration.getPersistValueForPluginWithDefault(this.name,"PublishedScenes",undefined);
	if (ps != undefined) {
		try {
			return JSON.parse(ps);
		}catch (err) {
			this.log.warn("persistent scene definition is broken. ignore that one.");
			this.configuration.setPersistValueForPlugin(this.name,"PublishedScenes","[]");
			return [];
		}
	}
	return [];	
} 

HueBridge.prototype.getConfiguredEffectServer = function() {
	var ps = this.configuration.getPersistValueForPluginWithDefault(this.name,"EffectServer",undefined);
	if (ps != undefined) {
		try {
			return JSON.parse(ps);
		}catch (err) {
			this.log.warn("persistent effect definition is broken. ignore that one.");
			this.configuration.setPersistValueForPlugin(this.name,"EffectServer","[]");
			return [];
		}
	}
	return [];	
} 

HueBridge.prototype.saveConfiguredScenes = function(publishedscenes) {
	var s = JSON.stringify(publishedscenes);
	this.configuration.setPersistValueForPlugin(this.name,"PublishedScenes",s);
} 

HueBridge.prototype.saveEffectScenes = function(publishedscenes) {
	var efs = [];
	var that = this;
	
	Object.keys(this.effectServers).forEach(function (name) {
	  var server = that.effectServers[name];
	  efs.push(server.persinstentData());
	});
	var s = JSON.stringify(efs);
	this.configuration.setPersistValueForPlugin(this.name,"EffectServer",s);
} 


HueBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	var listLights = "";
	var listGroups = "";
	var listScenes = "";
	var listEfxS = "";
	
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	

	var publishedscenes = this.getConfiguredScenes();
	if (publishedscenes == undefined) {
		publishedscenes = [];
	}
	
	var publishedgroups = this.getConfiguredGroups();
	if (publishedgroups == undefined) {
		publishedgroups = [];
	}
	
	var refresh = this.configuration.getValueForPluginWithDefault(this.name,"refresh",60); 
	
	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
			
			
			case "settings.save":
			{
				var refresh = queryObject["refresh"];
				this.configuration.setValueForPlugin(this.name,"refresh",refresh); 
				this.mappedDevices.forEach(function (light){
					light.reload()
				});
			}
			break;		
				
			case "scenetoggle":
			{
				var sceneid = queryObject["id"];
				if (sceneid!=undefined) {
					var idx = publishedscenes.indexOf(sceneid);
					if (idx>-1) {
					  publishedscenes.splice(idx, 1);
					} else {
   				      publishedscenes.push(sceneid);
					}
					
				}
			 this.saveConfiguredScenes(publishedscenes);
			}
			break;
			
			case "grouptoggle":
			{
				var groupid = queryObject["id"];
				if (groupid!=undefined) {
					var idx = publishedgroups.indexOf(groupid);
					if (idx>-1) {
					  publishedgroups.splice(idx, 1);
					} else {
   				      publishedgroups.push(groupid);
					}
					
				}
			 this.saveConfiguredGroups(publishedgroups);
			}
			break;
			
			case "publish":
			{
				if (this.sceneManager != undefined) {
					this.log.debug("Publish all configured scenes %s",publishedscenes);
					this.sceneManager.publish(publishedscenes,true);
				}
				
				if (this.groupManager != undefined) {
					this.log.debug("Publish all configured groups %s",publishedgroups);
					this.groupManager.publish(publishedgroups,true);
				}

			}
			break;
			
			case "efxs.createserver":
			{
				var servername = queryObject["efxs.newname"];
				if (servername) {
					var efs = new HueEffectServer(servername);
					this.effectServers[servername] = efs;
					this.saveEffectScenes();
				} else {
					this.log.warn("Servername not provided %s",servername);
				}
			}
			break;
			
			
			case "efxs.addlight":
			{
				var servername = queryObject["efxs.name"];
				var lightid = queryObject["light"];
				var efs = this.effectServers[servername];
				if (efs) {
					this.log.debug("SFX Found");
					var lightObject = this.lightWithId(lightid);
					if (lightObject) {
						this.log.debug("Add Light to efxs");
						efs.addLight(lightObject);
					}
				}
				this.saveEffectScenes();
			}
			break;

			case "efxs.removelight":
			{
				var servername = queryObject["efxs.name"];
				var lightid = queryObject["light"];
				var efs = this.effectServers[servername];
				if (efs) {
					this.log.debug("SFX Found");
					var lightObject = this.lightWithId(lightid);
					if (lightObject) {
						this.log.debug("Remove Light from efxs");
						efs.removeLight(lightObject);
					}
				}
				this.saveEffectScenes();
			}
			break;

			
			
			case "efxs.play":
			{
				var scene = queryObject["efxs.scene"];
				var servername = queryObject["efxs.name"];
				var efs = this.effectServers[servername];
				if (efs) {
					efs.runScene(scene);
				}

			}
			break;
			
			case "efxs.stop":
			{
				var servername = queryObject["efxs.name"];
				var efs = this.effectServers[servername];
				if (efs) {
					efs.stopScene();
				}
			}
			break;

			case "efxs.stopall":
			{
				Object.keys(this.effectServers).forEach(function (name) {
					var efs = that.effectServers[name];
					if (efs) {
						efs.stopScene();
					}
				});
			}
			break;

		}
		
	}
	
	
	var lighttemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_tmp.html",null);
	var grouptemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_group_tmp.html",null);
	var szenetemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_scene_tmp.html",null);

	var efxtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_efx_tmp.html",null);
	var efxSceneListtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_efx_slist_tmp.html",null);
	var efxLighttemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_efx_light_tmp.html",null);
	
	var that = this;

	this.lights.forEach(function (light){
		listLights = listLights +  dispatched_request.fillTemplate(lighttemplate,{"lamp_name":light["name"],"lamp_hmdevice":light["hm_device_name"]});
	});
	
	
	
	if (this.groupManager != undefined) {
		
		this.groupManager.getMappedGroups().map(function (group){
			var gid = String(group["id"]);
			var idx = publishedgroups.indexOf(gid);
			var strindicator = (idx>-1) ? "[X]":"[ ]"
			var hmChannel = (group["hm_device_name"] == undefined) ? "not mapped" : group["hm_device_name"];
			listGroups = listGroups + dispatched_request.fillTemplate(grouptemplate,{"groupid":group["id"],
				"published":strindicator,
				"lamp_name":group["name"],
				"lamp_hmdevice":hmChannel});
		});
	} 
	
	if (this.sceneManager != undefined) {
		this.sceneManager.getMappedScenes().map(function (scene){
			
			var idx = publishedscenes.indexOf(scene["id"]);
			
			var strindicator = (idx>-1) ? "[X]":"[ ]"
			var hmChannel = (scene["hmchannel"] == undefined) ? "not mapped" : scene["hmchannel"];
			listScenes = listScenes + dispatched_request.fillTemplate(szenetemplate,{"sceneid":scene["id"],
				"published":strindicator,
				"lamp_name":scene["name"],
				"lamp_hmdevice":hmChannel});
		});
	} 

    // Build EfxS List
    Object.keys(this.effectServers).forEach(function (name) {
	    that.log.debug("Show EfxS %s",name);
	    var lightList = "";
	    var scenelist = "";
	    var efxs = that.effectServers[name];
	    if (efxs) {
	    
	    that.lights.forEach(function (light){
		    var hazLight = efxs.hasLightWithId(light["id"]);
			var inUse = (hazLight == true) ? "X":" ";
		    var efxsfunction = (hazLight == true) ? "removelight":"addlight";
		    
			lightList = lightList +  dispatched_request.fillTemplate(efxLighttemplate,{"efxs.name":name,
																					   "lamp.name":light["name"],
																					 "lamp.lampid":light["id"],
																					  "lamp.inuse":inUse,
																				   "efxs.function":efxsfunction});
		});
	    
	    efxs.listScenes().forEach(function (scene){
		    scenelist = scenelist + dispatched_request.fillTemplate(efxSceneListtemplate,{"efxs.scene":scene});
	    });
	    
		listEfxS = listEfxS + dispatched_request.fillTemplate(efxtemplate,{"efxs.name":name,
																		 "efxs.lights":lightList,
																		 "efxs.scenes":scenelist});
																		 
		}
	});

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"refresh":refresh,
																		"listLights":listLights,
																		"listGroups":listGroups,
																		"listScenes":listScenes,
																		  "listEfxS":listEfxS});
}

module.exports = {
  HueBridge : HueBridge
}
