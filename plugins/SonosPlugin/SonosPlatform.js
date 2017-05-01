//
//  SonosPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 28.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var Sonos = require('node-sonos');
var ZonePLayer = require('node-sonos').Sonos;
var _ = require('underscore')
var path = require('path');
var fs = require('fs');
var url = require("url");
var SonosDevice = require(path.join(__dirname,'SonosDevice.js')).SonosDevice;
var SonosCoordinator = require(path.join(__dirname,'SonosCoordinator.js')).SonosCoordinator;


var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot,'..','..','..','node_modules','homematic-virtual-interface','lib')}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");


function SonosPlatform(plugin,name,server,log,instance) {
	SonosPlatform.super_.apply(this,arguments);
	this.bridge = server.getBridge();
	this.devices = [];
	this.discoveredDevices = [];

	HomematicDevice = server.homematicDevice;
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");
}

util.inherits(SonosPlatform, HomematicVirtualPlatform);



SonosPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();
	this.maxVolume = this.configuration.getValueForPlugin(this.name,"max_volume",undefined) || 20;
	this.volumeTable = this.configuration.getValueForPlugin(this.name,"volume_table",undefined);
	// Add Coordinator Device
	this.coordinator = new SonosCoordinator(this)
	
	
	var players = this.configuration.getValueForPlugin(this.name,"player");
	if (players) {
		this.log.info('Adding defined devices ...')
		players.forEach(function (host){
			if (typeof host == 'object') {
				var zname = Object.keys(host)[0]
				that.addZonePlayer(host[zname],zname)			
			} else {
				that.addZonePlayer(host);
			}
		});
		this.plugin.initialized = true;
		this.refreshZoneAttributes();
		this.log.info("initialization completed");
	} 	
}

SonosPlatform.prototype.refreshZoneAttributes = function() {
		var that = this

		this.devices.some(function (device){
			device.refreshZoneGroupAttrs()
		})
		
		setTimeout(function() {
			that.refreshZoneAttributes()
		}, 30000);
}

SonosPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request);
	var volume_ramp_time = this.configuration.getValueForPlugin(this.name,"volume_ramp_time",0);
	var default_playlist = this.configuration.getValueForPlugin(this.name,"default_playlist","");
	var result = [];
	result.push({"control":"text",
					"name":"maxVolume",
				   "label":this.localization.localize("Maximum Volume (optional)"),
				   "value":this.maxVolume || 20,
		     "description":this.localization.localize("This is the maximum of volume which can be set thru the sonos plugin. Default is 20. This is to protect your neighbourhood from unsolicited noice")
	});

	result.push({"control":"text",
					"name":"volume_ramp_time",
				   "label":this.localization.localize("Volume ramp time (optional)"),
				   "value":volume_ramp_time || 0,
		     "description":this.localization.localize("If set to more than 0 (ms) the volume will changed thru a ramp with this time between 2 steps.")
	});

	result.push({"control":"text",
					"name":"default_playlist",
				   "label":this.localization.localize("Default Playlist"),
				   "value":default_playlist || "",
		     "description":this.localization.localize("If the player should play this will be the default playlist.")
	});

	result.push({"control":"text",
					"name":"volume_table",
				   "label":this.localization.localize("Volumetable"),
				   "value":this.volume_table || "",
		     "description":this.localization.localize("24 values to use with autovolume. Separated with , (0-100)")
	});

	
	return result;
}

SonosPlatform.prototype.saveSettings = function(settings) {
	var maxVolume = settings.maxVolume;
	var volume_ramp_time = settings.volume_ramp_time;
	
	if  (maxVolume) {
		this.maxVolume = maxVolume;
		this.configuration.setValueForPlugin(this.name,"maxVolume",maxVolume); 
		this.devices.some(function(device){
			device.maxVolume = maxVolume;
		});
	}
	
	if  (volume_ramp_time) {
		this.configuration.setValueForPlugin(this.name,"volume_ramp_time",volume_ramp_time); 
		this.devices.some(function(device){
			device.setRampTime(volume_ramp_time);
		});
	}

	if  (settings.default_playlist) {
		this.configuration.setValueForPlugin(this.name,"default_playlist",settings.default_playlist); 
	}

	if  (settings.volume_table) {
		this.configuration.setValueForPlugin(this.name,"volume_table",settings.volume_table); 
		this.volume_table = settings.volume_table
	}

}


SonosPlatform.prototype.shutdown = function() {
	this.log.debug("Sonos Plugin Shutdown");
	this.devices.some(function (device){
		device.shutdown();
	})
}

SonosPlatform.prototype.texttospeech = function(text,callback) {
	var that = this;
	var url = 'http://translate.google.com/translate_tts'
	
	
    var tmppath = path.join(this.configuration.storagePath(),"tmp.mp3")
	var util = require(path.join(appRoot, "Util.js"));
	util.httpDownload("GET",url,{
		"ie":"UTF-8",
		"client":"tw-ob",
		"q":text,
		"tl":"de",
		"total":"1",
		"idx":"0",
		"textlen":text.length
	},tmppath,function(result,error){
		if (callback) {
			var weblocation = that.bridge.getLocalIpAdress() +':'+that.config.getValueWithDefault("web_http_port",8182) + '/tmp/tmp.mp3';
			callback(weblocation)
		}
	})
}

SonosPlatform.prototype.addZonePlayer = function(host,cname,callback) {
  var that = this;
  this.log.debug("Try to add %s with Name %s",host,cname)
  var zp = new ZonePLayer(host);
  zp.deviceDescription( function (error,data) {
	  that.log.debug("ZonePlayer name(%s), UDN(%s) Error(%s)",data.roomName,data.UDN,error)
	  try {
		  var name = cname || data.roomName;
		  var sdevice = new SonosDevice(that ,host,1400,"SONOS_" + name);
		  var puuid = data.UDN.substring(5)
		  that.log.info("Add RINCON %s max volume is %s",puuid,that.maxVolume)
		  sdevice.rincon = puuid;
		  sdevice.zonename = name;
		  
		  sdevice.maxVolume = that.maxVolume;
		  that.devices.push(sdevice);
		  that.coordinator.addZonePlayer(sdevice)
		  if (callback) {
			  callback()
		  }
	  } catch (e) {
		  that.log.error(e.stack)
	  }
  });
}

SonosPlatform.prototype.savePlayers = function() {
   var pts = []
   this.devices.some(function(device){
	   var ele = {}
	   ele[device.zonename] = device.ip
	   pts.push(ele)
   })
   this.log.debug("Player to save %s",JSON.stringify(pts))
   this.configuration.setValueForPlugin(this.name,"player",pts);
}


SonosPlatform.prototype.zonePlayerWithRincon = function(rincon) {
	var result = undefined
	this.devices.some(function (device){
		if (device.rincon == rincon) {
			result = device
		}
	})
	return result
}


SonosPlatform.prototype.myDevices = function() {
	// return my Devices here
	var result = [];
	result.push({"id":"sep-son","name":"--------- Sonos Devices ---------","type":"seperator"});

	this.devices.forEach(function(device){
		result.push({"id":device["playername"],"name":device["playername"],"udn":device["rincon"],"type":"SONOS"});
	});

	return result;	
}

SonosPlatform.prototype.getPlayer = function(name) {
	// return my Devices here
	var result;
	this.devices.some(function(device){
		if (device["playername"] == name) {
			result = device
		}
	});
	return result;	
}


SonosPlatform.prototype.getPlayerByRinCon = function(rincon) {
	// return my Devices here
	var result;
	this.devices.some(function(device){
		if (device["rincon"] == rincon) {
			result = device
		}
	});
	return result;	
}



SonosPlatform.prototype.search = function() {
	var devices = []
	var that = this;
	this.discoveredDevices = []
	Sonos.search(function (device, model) {
	var data = {ip: device.host, port: device.port, model: model}

	device.getZoneAttrs(function (err, attrs) {
    	if (!err) {_.extend(data, attrs)}
    device.getZoneInfo(function (err, info) {
	    if (!err) {_.extend(data, info)}
      device.getTopology(function (err, info) {
        if (!err) {
          info.zones.forEach(function (group) {
            if (group.location === 'http://' + data.ip + ':' + data.port + '/xml/device_description.xml') {_.extend(data, group)}
          })
        }
        devices.push(data)
      })
    })
  })
})

	
	
	
	setTimeout(function () {
	var i = 0;
	that.getZones(devices).forEach(function (zone) {
   		 var coordinator = that.getZoneCoordinator(zone, devices)
   		 if (coordinator !== undefined) {
	   		 that.log.info(JSON.stringify(coordinator));
	   		 if (that.zonePlayerWithRincon(coordinator.uuid)==undefined) {
		   		 that.discoveredDevices.push({"name":coordinator.CurrentZoneName,"host":coordinator.ip,"rincon":coordinator.uuid})
	   		 }
	   	 }
  	})
  	that.plugin.initialized = true;
	that.log.info("initialization completed");
	}, 5000)
}



SonosPlatform.prototype.getZones = function (deviceList) {
  var zones = []
  var that = this;
  deviceList.forEach(function (device) {
    if (zones.indexOf(device.CurrentZoneName) === -1 && device.CurrentZoneName !== 'BRIDGE') {
      zones.push(device.CurrentZoneName)
    }
  })
  return zones
}

SonosPlatform.prototype.getZoneDevices = function(zone, deviceList) {
  var zoneDevices = []
  deviceList.forEach(function (device) {
    if (device.CurrentZoneName === zone) {
      zoneDevices.push(device)
    }
  })
  return zoneDevices
}

SonosPlatform.prototype.getZoneCoordinator = function(zone, deviceList) {
  var coordinator
  deviceList.forEach(function (device) {
    if (device.CurrentZoneName === zone && device.coordinator === 'true') {
      coordinator = device
    }
  })
  return coordinator
}



SonosPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	
	var listDevices = "";
	var newDevices = "";
	var cfg_handled = false
	var that = this
	var devtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
	var newdevtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_new.html",null);
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;

	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
		
		   case "search":
		     this.search()
		     dispatched_request.dispatchMessage('{"result":"OK"}')
		     cfg_handled = true
		     break; 
		     
		   case "addplayer":
		    {
			    var host = queryObject['host']
			    var name = queryObject['name']
			    if ((host) && (name)) {
				   this.addZonePlayer(host,name,function (){
					   that.savePlayers()
					   for(var i = that.discoveredDevices.length - 1; i >= 0; i--) {
				   			if(that.discoveredDevices[i]['host'] === host) {
				   				that.discoveredDevices.splice(i, 1);
    						}
						}
						dispatched_request.dispatchMessage('{"result":"OK"}')
					})
				} else {
					dispatched_request.dispatchMessage('{"result":"FAIL"}')
				}
		    } 
		     cfg_handled = true
		     break;   
		}
	}

	if (cfg_handled == false) {
	this.myDevices().some(function (device){
		listDevices = listDevices +  dispatched_request.fillTemplate(devtemplate,{"device_name":device["name"],"device_hmdevice":device['udn']});
	});
	
	this.discoveredDevices.some(function (device){
		newDevices = newDevices +  dispatched_request.fillTemplate(newdevtemplate,{"device_name":device["name"],"host":device['host']});
	});

	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listDevices":listDevices,"newDevices":newDevices});
	}
}


module.exports = SonosPlatform;
