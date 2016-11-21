//
//  HueBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HueApi = require("node-hue-api").HueApi;
var HueDevice = require(__dirname + "/HueDevice.js").HueDevice;
var HueSceneManager = require(__dirname + "/HueSceneManager.js").HueSceneManager;

var HueBridge = function(plugin,server,log) {
	this.plugin = plugin;
	this.mappedDevices = [];
	this.hue_ipAdress;
	this.hue_userName;
	this.hue_api;
	this.server = server;
	this.log = log;
	this.lights = [];
	this.groups = [];
}


HueBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	
	
	if ((this.configuration.getValue("hue_bridge_ip")!=undefined) && (this.configuration.getValue("hue_bridge_ip")!="")) {
    this.hue_ipAdress = this.configuration.getValue("hue_bridge_ip");
    
	this.log.info("Hue Bridge Init at " + this.hue_ipAdress);

	if (this.checkUsername()==true) {
	    this.queryBridgeAndMapDevices()
    }

} else {
	
	this.locateBridge( function (err) {
        if (err) throw err;
		if (that.hue_ipAdress != undefined) {
	        that.configuration.setValue("hue_bridge_ip",that.hue_ipAdress); 
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
   if ((this.configuration.getValue("hue_username")==undefined) || (this.configuration.getValue("hue_username")=="")) {
       this.log.info("trying to create a new user at your bridge");
	   var api = new HueApi(that.hue_ipAdress);
        api.createUser(that.hue_ipAdress,function(err, user) {
          // try and help explain this particular error
          
          if (err && err.message == "link button not pressed") {
            that.log.warn("Please press the link button on your Philips Hue bridge within 30 seconds.");
            setTimeout(function() {that.checkUsername();}, 10000);
          } else {
	        that.configuration.setValue("hue_username",user); 
            that.log.info("saved your user to config.json");
            that.hue_userName = user;
            return true;
          }
        });
   } else {
     that.hue_userName = that.configuration.getValue("hue_username");
	 return true;   
   }
}


// Make a connection to the HUE Bridge... if there are no credentials .. try to find a bridge

	
HueBridge.prototype.queryBridgeAndMapDevices = function() {

this.hue_api = new HueApi(this.hue_ipAdress,this.hue_userName);

this.sceneManager = new HueSceneManager(this,this.hue_api);

// --------------------------
// Fetch Lights
this.queryLights();
// Fetch the Groups
this.queryGroups();
// Fetch all Scenes
this.queryScenes();
this.log.info("initialization completed");
}


HueBridge.prototype.queryLights = function() {
	var that = this;
	this.hue_api.lights(function(err, lights) {
	
	if ((lights != undefined) && (lights["lights"]!=undefined)) {
  		lights["lights"].forEach(function (light) {
    		that.log.debug("Create new Light " + light["name"]);
    		var hd = new HueDevice(that,that.hue_api,light,"HUE0000");
    		light["hm_device_name"] = "HUE0000" + light["id"];
    		that.lights.push(light);
    		that.mappedDevices.push(hd);
  		});
  	that.log.debug("Lightinit completed with " + that.lights.length + " devices mapped.");
  	}
	});
}


HueBridge.prototype.queryGroups = function() {
	var that = this;
	this.hue_api.groups(function(err, groups) {
	
	if (groups != undefined) {
		var id = 1;
		groups.forEach(function (group) {
    		that.log.debug("Adding new Group " + group["name"]+ " to " + that.hm_layer.ccuIP);
    		group["id"] = id;
    		group["hm_device_name"] = "HUEGROUP00" + group["id"];
			that.mappedDevices.push(new HueDevice(that,that.hue_api,group,"HUEGROUP00"));
    		id = id +1;
    		that.groups.push(group);
  		});
  	}  
  	that.log.debug("Groupinit completed with "+ that.groups.length +" devices mapped.");
	});
}

HueBridge.prototype.queryScenes = function() {
	var that = this;
	var scnt = 0;
	this.hue_api.getScenes(function(err, scenes) {
	scenes.forEach(function (scene) {
		
		//if (scene["recycle"]==false) {
			scnt = scnt + 1;
			that.sceneManager.addScene(scene);
		//}
		
	});
  	that.sceneManager.publish();
  	that.log.debug("Sceneinit completed with "+ scnt +" scenes mapped.");
	});
}

HueBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	var listLights = "";
	var listGroups = "";
	var listScenes = "";
	
	var lighttemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_lamp_tmp.html",null);
	var that = this;

	this.lights.map(function (light){
		listLights = listLights +  dispatched_request.fillTemplate(lighttemplate,{"lamp_name":light["name"],"lamp_hmdevice":light["hm_device_name"]});
	});


	this.groups.map(function (group){
		listGroups = listGroups +  dispatched_request.fillTemplate(lighttemplate,{"lamp_name":group["name"],"lamp_hmdevice":group["hm_device_name"]});
	});
	
	if (this.sceneManager != undefined) {
		this.sceneManager.getMappedScenes().map(function (scene){
			listScenes = listScenes +  dispatched_request.fillTemplate(lighttemplate,{"lamp_name":scene["name"],"lamp_hmdevice":scene["hmchannel"]});
		});
	} 

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listLights":listLights,"listGroups":listGroups,"listScenes":listScenes});
}

module.exports = {
  HueBridge : HueBridge
}
