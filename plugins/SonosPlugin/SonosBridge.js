//
//  SonosBridge.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 28.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var HomematicDevice;
var Sonos = require('sonos');
var _ = require('underscore')
var path = require('path');
var SonosDevice = require(__dirname + "/SonosDevice.js").SonosDevice;


var SonosBridge = function(plugin,name,server,log) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.bridge = server.getBridge();
	this.devices = [];
	HomematicDevice = server.homematicDevice;
}


SonosBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
    this.hm_layer = this.server.getBridge();

	this.log.info('Searching for Sonos devices...')
	this.search();
}

SonosBridge.prototype.search = function() {
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



SonosBridge.prototype.getZones = function (deviceList) {
  var zones = []
  var that = this;
  deviceList.forEach(function (device) {
    if (zones.indexOf(device.CurrentZoneName) === -1 && device.CurrentZoneName !== 'BRIDGE') {
      zones.push(device.CurrentZoneName)
    }
  })
  return zones
}

SonosBridge.prototype.getZoneDevices = function(zone, deviceList) {
  var zoneDevices = []
  deviceList.forEach(function (device) {
    if (device.CurrentZoneName === zone) {
      zoneDevices.push(device)
    }
  })
  return zoneDevices
}

SonosBridge.prototype.getZoneCoordinator = function(zone, deviceList) {
  var coordinator
  deviceList.forEach(function (device) {
    if (device.CurrentZoneName === zone && device.coordinator === 'true') {
      coordinator = device
    }
  })
  return coordinator
}



SonosBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",undefined);
}


module.exports = {
  SonosBridge : SonosBridge
}
