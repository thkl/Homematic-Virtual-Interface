//
//  SonosPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 28.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var Sonos = require('sonos');
var ZonePLayer = require('sonos').Sonos;
var _ = require('underscore')
var path = require('path');
var SonosDevice = require(__dirname + "/SonosDevice.js").SonosDevice;

var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var util = require("util");


function SonosPlatform(plugin,name,server,log,instance) {
	SonosPlatform.super_.apply(this,arguments);
	this.bridge = server.getBridge();
	this.devices = [];
	HomematicDevice = server.homematicDevice;

}

util.inherits(SonosPlatform, HomematicVirtualPlatform);



SonosPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();

	var players = this.configuration.getValueForPlugin(this.name,"player");
	if (players) {
		this.log.info('Adding defined devices ...')
		players.forEach(function (host){
			that.addZonePlayer(host);
		});
		this.plugin.initialized = true;
		this.log.info("initialization completed");
	} else {
		this.log.info('Searching for Sonos devices...')
		this.search();
	}
	
}

SonosPlatform.prototype.addZonePlayer = function(host) {
  var that = this;
 
  var zp = new ZonePLayer(host);
  zp.deviceDescription( function (error,data) {
	  var name = data.roomName;
      var sdevice = new SonosDevice(that ,host,1400,"SONOS_" + name);
	  that.devices.push(sdevice);
  });
}


SonosPlatform.prototype.myDevices = function() {
	// return my Devices here
	var result = [];
	
	this.devices.forEach(function(device){
		result.push({"id":device["playername"],"name":device["playername"],"type":"SONOS"});
	});

	return result;	
}

SonosPlatform.prototype.search = function() {
	var devices = []
	var that = this;
	
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
	   		 that.log.info(zone);
	   		 
	   		 var sdevice = new SonosDevice(that ,coordinator.ip,coordinator.port,"SONOS_" + coordinator.CurrentZoneName);
	   		 that.devices.push(sdevice);
	   		 i = i + 1;
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
	var devtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);

	this.myDevices().some(function (device){
		listDevices = listDevices +  dispatched_request.fillTemplate(devtemplate,{"device_name":device["name"],"device_hmdevice":""});
	});
	
	
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",{"listDevices":listDevices});
}


module.exports = SonosPlatform;
