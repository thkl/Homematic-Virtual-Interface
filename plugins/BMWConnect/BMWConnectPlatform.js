'use strict'

//
//  BMWConnectPlatform.js
//  Homematic Virtual Interface BMW Connect
//
//  Created by Thomas Kluge on 15.02.19
//  Copyright © 2019 kSquare.de. All rights reserved.



const path = require('path');
const fs = require("fs");
const util = require("util");
const BMWConnectedDrive = require(path.join(__dirname , 'BMWConnectedDrive.js')).BMWConnectedDrive

var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = path.join(appRoot, '..','lib'); }

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var HomematicDevice
var url = require('url')

function BMWConnectPlatform (plugin, name, server, log, instance) {
  BMWConnectPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(BMWConnectPlatform, HomematicVirtualPlatform)


BMWConnectPlatform.prototype.init = function () {
  this.plugin.initialized = true
  this.configuration = this.server.configuration;

  this.log.info('initialization completed %s', this.plugin.initialized)
  this.query()
}


BMWConnectPlatform.prototype.createDevice = function (serial) {
  var that = this
  // first make sure we have the device data 
  var devfile = path.join(__dirname,'HM-Sen-Wa-Od.json');
  var buffer = fs.readFileSync(devfile);
  var devdata = JSON.parse(buffer.toString());
  var hmDevice 
  this.server.transferHMDevice('HM-Sen-Wa-Od',devdata);

  hmDevice = new HomematicDevice(this.getName())
  var data = this.bridge.deviceDataWithSerial(serial)
  if (data!=undefined) {
	hmDevice.initWithStoredData(data)
  }
  
  if (hmDevice.initialized === false) {
	  // if not build a new device from template
	  hmDevice.initWithType("HM-Sen-Wa-Od",serial)
	  hmDevice.serialNumber = serial
	  this.bridge.addDevice(hmDevice,true)
  } else {
	  this.bridge.addDevice(hmDevice,false)
  }
  return hmDevice 
}


BMWConnectPlatform.prototype.query = function () {
  let username = this.configuration.getValueForPlugin(this.name,"username",undefined);
  let password = this.configuration.getValueForPlugin(this.name,"password",undefined);

  const that = this;
  if ((username != undefined) && (password != undefined)) {
	  
  	let cd = new BMWConnectedDrive(username,password,this.log)

  	cd.login(function(){
		cd.getVehicles(function(list){
			list.map(function (aVehicle){
				cd.getVehicleData(aVehicle,function(vehicle){
					 let vin = aVehicle.vin.substr(aVehicle.vin.length -  7 , 7)
					 var serial = 'BMW_Battery_' + vin
					 let device = that.bridge.deviceWithSerial(serial)
					 if (device === undefined) {
						 device = that.createDevice(serial)
					 }
					 let lvl = aVehicle.battery
					 that.log.info('Updating Filling data %s',lvl)
					 var di_channel = device.getChannelWithTypeAndIndex('CAPACITIVE_FILLING_LEVEL_SENSOR','1')
					 di_channel.updateValue('FILLING_LEVEL',lvl,true);
					 let rftime =  Math.floor(Math.random() * (50) + 10)
					 that.log.info('Next query in %s',rftime)
					 setTimeout(function(){
			  	  	  	 that.query()
			  	  	 }, rftime * 60000)
					
				})
			})
		})
	})
  } else {
	  this.log.warn("Please setup your credentials")
  }
}

BMWConnectPlatform.prototype.showSettings = function(dispatched_request) {
	let username = this.configuration.getValueForPlugin(this.name,"username","");
	let password = this.configuration.getValueForPlugin(this.name,"password","");

  	var result = [];
	result.push({"control":"text","name":"username","label":"Connected Drive User","value":username});
	result.push({"control":"text","name":"password","label":"Connected Drive Password","value":password});
	return result;
}

BMWConnectPlatform.prototype.saveSettings = function(settings) {
	let that = this
	let username = settings.username;
	let password = settings.password;
	if ((password) && (password)) {
		this.configuration.setValueForPlugin(this.name,"username",username)
		this.configuration.setValueForPlugin(this.name,"password",password)
		this.query()
	}
}

BMWConnectPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''

  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  }

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = BMWConnectPlatform
