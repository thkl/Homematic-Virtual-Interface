'use strict'

const path = require('path')
const fs = require('fs')

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
  this.securityID = this.configuration.getValueForPlugin(this.name,'tradfri_securityid')
  this.bridgeIp = this.configuration.getValueForPlugin(this.name,'tradfri_ip')
  this.coapPath = this.configuration.getValueForPluginWithDefault(this.name,'path_to_coap',path.join(__dirname,'node_modules','node-tradfri-thkl','lib','coap-client-raspbian'))
  
  
  if (this.bridgeIp!=undefined) {
	  this.reconnect()  
  }
  this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}


TradfriPlatform.prototype.reconnect = function() {
	
  var that = this
  this.gateway = tradfri.create({
    coapClientPath: that.coapPath, // Path to coap-client
    securityId: that.securityID,        // As found on the IKEA hub
    hubIpAddress: that.bridgeIp    // IP-address of IKEA hub
  })
  
  this.gateway.getDevices().then((devices) => {
    devices.forEach((device) => {
        this.log.debug('Devices %s',JSON.stringify(device));
        if (device['brightness'] != undefined) {
			var tdevice = new TradfriDevice(this,this.gateway,device,device.id)
			that.lights.push(tdevice)        
        }
        
    });
  }).catch((error) => {
    // Manage the error
    this.log.error('Error %s,',error);
  });
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
		this.configuration.setValueForPlugin(this.name,"tradfri_securityid",tradfri_securityid); 
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

TradfriPlatform.prototype.shutdown = function() {
    this.log.info("Shutdown");
 	this.server.getBridge().deleteDevicesByOwner(this.name)
    this.lights = [];
}



module.exports = TradfriPlatform
