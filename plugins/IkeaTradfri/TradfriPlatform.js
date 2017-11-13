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
const tradfri = require('node-tradfri-thkl')
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

  if (this.tradfriUser == undefined) {
	  // generate a new User
	  this.tradfriUser = crypto.randomBytes(10).toString('hex')
	  this.securityCode = undefined
	  this.log.info('have to generate a new username')
  }
  
  this.gateway = tradfri.create({
    coapClientPath: that.coapPath, // Path tocoap-client
    securityId: (that.securityCode != undefined) ? that.securityCode : that.securityID,        // As found on the IKEA hub
    userName:that.tradfriUser,
    hubIpAddress: that.bridgeIp    // IP-address of IKEA hub
  })
  
  // Check if we have to authenticate
  if (this.securityCode == undefined) {
	  
	  this.log.warn('we have to authenticate first')
	  
	  this.gateway.authenticate().then((result) => {
		  
		  if ((result) && (result['9091'])) {
			  that.configuration.setValueForPlugin(that.name,"tradfri_securityCode",result['9091']); 
			  that.configuration.setValueForPlugin(that.name,"tradfri_user",that.tradfriUser); 
			  that.securityCode = result['9091']
			  that.log.info('authentication done save user and code. as requested by ikea we will also remove the bridge security key')
			  that.configuration.setValueForPlugin(that.name,"tradfri_securityid",'removed'); 
		  }
		  
	  }).catch((error) => {
    	  that.log.error('Tradfri Error %s',error);
  	  });
  	  
  } else {
  
  this.gateway.getDevices().then((devices) => {
    devices.forEach((device) => {
        this.log.debug('Devices %s',JSON.stringify(device));
        if (device['brightness'] != undefined) {
	        if (that.hazLampWithId(device.id) === false) {
				var tdevice = new TradfriDevice(this,this.gateway,device,device.id)
				that.lights.push(tdevice) 
				that.log.info('Lamp %s added',device.id)       
			} else {
				that.log.debug('Skip adding %s because lamp is here',device.id)
			}
        }
    });
  }).catch((error) => {
    // Manage the error
    this.log.error('Error %s',error);
  });
  
  }
  
  setTimeout(function(){
	  that.reconnect()
  }, 30000)
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
	result.push({"control":"text","name":"path_to_coap","label":"Path to coap client","value": this.coapPath,"description":this.localization.localize("see https://github.com/nidayand/node-tradfri-argon#compiling-libcoap (default setting is for raspberry)")});
	return result;
}

TradfriPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var tradfri_securityid = settings.tradfri_securityid;
	var tradfri_ip = settings.tradfri_ip;
	var path_to_coap = settings.path_to_coap;
	
	if (tradfri_securityid) {
		this.securityID = tradfri_securityid;
		// As requested by IKEA do not save the Code
		//this.configuration.setValueForPlugin(this.name,"tradfri_securityid",tradfri_securityid); 
	}

	if (tradfri_ip) {
		this.bridgeIp = tradfri_ip;
		this.configuration.setValueForPlugin(this.name,"tradfri_ip",tradfri_ip); 
	}

	if (path_to_coap) {
		this.coapPath = path_to_coap
		this.configuration.setValueForPlugin(this.name,"path_to_coap",path_to_coap); 
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
}



module.exports = TradfriPlatform
