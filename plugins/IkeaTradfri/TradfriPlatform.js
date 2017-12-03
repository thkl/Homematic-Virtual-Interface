'use strict'

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
const tradfriLib = require("node-tradfri-client")
const TradfriClient = tradfriLib.TradfriClient
const AccessoryTypes = tradfriLib.AccessoryTypes


var util = require('util')
var HomematicDevice
var url = require('url')
var TradfriDevice = require("./TradfriDevice.js").TradfriDevice;

function TradfriPlatform (plugin, name, server, log, instance) {
  TradfriPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
  this.lights = [];
}

util.inherits(TradfriPlatform, HomematicVirtualPlatform)

TradfriPlatform.prototype.init = function () {
  this.configuration = this.server.configuration
  this.tradfriUser = this.configuration.getValueForPlugin(this.name,'tradfri_user')
  this.securityCode = this.configuration.getValueForPlugin(this.name,'tradfri_securityCode')
  this.bridgeIp = this.configuration.getValueForPlugin(this.name,'tradfri_ip')
  this.coapPath = this.configuration.getValueForPluginWithDefault(this.name,'path_to_coap',path.join(__dirname,'node_modules','node-tradfri-thkl','lib','coap-client-raspbian'))
  this.tradfriUser = this.configuration.getValueForPlugin(this.name,'tradfri_user')
  
  if (this.bridgeIp!=undefined) {
	  this.reconnect()  
  } else {
	  this.log.warn('missing bridge ip')
  }

  this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}


TradfriPlatform.prototype.reconnect = function() {
	
  var that = this

  if ((this.securityCode == undefined) && (this.securityID == undefined)) {
	  this.log.warn('No credentials')
	  return
  }
  
  this.gateway = new TradfriClient(that.bridgeIp);
    
  // Check if we have to authenticate
  if ((this.securityCode == undefined) || (this.tradfriUser == undefined)){
	  
	  this.log.warn('we have to authenticate first')
	  
	  this.gateway.authenticate(this.securityID).then((identity, psk) => {
        // work with the result
        that.tradfriUser = identity
        that.securityCode = psk
		that.configuration.setValueForPlugin(that.name,"tradfri_securityCode",that.securityCode); 
		that.configuration.setValueForPlugin(that.name,"tradfri_user",that.tradfriUser); 
		that.configuration.setValueForPlugin(that.name,"tradfri_securityid",'removed'); 
		setTimeout(function(){that.reconnect()}, 1000)
      })
      
    .catch((e) => {
	    that.log.error('Gateway authentication error %s',e)
    })
	  
  } else {
	  
  this.gateway.reset();
  this.gateway.connect(that.tradfriUser, that.securityCode).catch((e) => {
	that.log.error(e)  
  })
  
  
  this.gateway
    .on("device updated", function(device) {
	   if (device.type === AccessoryTypes.lightbulb) {
		   let idevice = device.lightList[0]
		   
		   var hm_lamp = that.lampWithId(device.instanceId)
		   if (hm_lamp == undefined) {
		   	   hm_lamp = new TradfriDevice(that,idevice,device.instanceId)	
			   that.lights.push(hm_lamp)
		   }

		   that.log.debug('Update Level for  Lamp %s',idevice.dimmer) 
		   
		   hm_lamp.updateLevel(idevice.onOff, (idevice.dimmer / 100))	
		   if (idevice.spectrum === 'white') {	
			   that.log.debug('Update Color for White Lamp %s',idevice.color) 
		   		hm_lamp.updateWhite(idevice.color)  
		   } 
	   } else {

	   }
    })
    
    .on("device removed", function(instanceId) {
	    
    })
    .observeDevices();
   
 } 

}

TradfriPlatform.prototype.lampWithId = function(lampId) {
	var result = undefined	
		this.lights.some(function (light){
			if (light.id === lampId) {
				result = light
			}
		})
	return result
}


TradfriPlatform.prototype.hazLampWithId = function(lampId) {
	var result = false	
		this.lights.some(function (light){
			if (light.id === lampId) {
				result = true
			}
		})
	return result
}


TradfriPlatform.prototype.myDevices = function() {
	// return my Devices here
	var result = [];
	result.push({"id":"sep-trad","name":"--------- Tradfri Devices ---------","type":"seperator"});

	this.lights.forEach(function(light){
		result.push({"id":light.serial,"name":light.ikeaName,"udn":light.serial,"type":"TRADFRI"});
	});
	return result;	
}



TradfriPlatform.prototype.showSettings = function(dispatched_request) {
	var result = [];
	result.push({"control":"text","name":"tradfri_securityid","label":"Security ID","value":this.securityID,"description":this.localization.localize("See backside of your bridge")});
	result.push({"control":"text","name":"tradfri_ip","label":"Bridge IP","value": this.bridgeIp });
	return result;
}

TradfriPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var tradfri_securityid = settings.tradfri_securityid;
	var tradfri_ip = settings.tradfri_ip;
	
	if (tradfri_securityid) {
		this.securityID = tradfri_securityid;
	}

	if (tradfri_ip) {
		this.bridgeIp = tradfri_ip;
		this.configuration.setValueForPlugin(this.name,"tradfri_ip",tradfri_ip); 
	}

	this.reconnect()
}


TradfriPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
  var cfg_handled = false
  
  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  }
  
  	this.lights.some(function (light){
		deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{"device_name":light.ikeaName,"device_hmdevice":light.serial,"device_type":light.ikeaType});
	
	});

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

TradfriPlatform.prototype.shutdown = function() {
    this.log.info("Shutdown");
 	this.server.getBridge().deleteDevicesByOwner(this.name)
    this.lights = [];
    this.gateway.destroy();
}



module.exports = TradfriPlatform
