'use strict'

const path = require('path')
const fs = require('fs')
const Mqtt = require('mqtt')


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
var util = require('util')
var HomematicDevice
var url = require('url')

function MQTTPlatform (plugin, name, server, log, instance) {
  MQTTPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(MQTTPlatform, HomematicVirtualPlatform)

MQTTPlatform.prototype.init = function () {
 
  var that = this
  this.devices = [];
  this.configuration = this.server.configuration
  this.localization = require(appRoot + '/Localization.js')(__dirname + '/Localizable.strings')
  this.log.info('Init %s',this.name)
 
  this.loadDevices();
  this.initMqttConnection();
}
   
MQTTPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []

	var host = this.configuration.getValueForPlugin(this.name,'broker_host')
	var user = this.configuration.getValueForPlugin(this.name,'client_user')
	var password = this.configuration.getValueForPlugin(this.name,'client_password')


	result.push({"control":"text","name":"broker_host","label":"Url of your MQTT Broker","value":host})
	result.push({"control":"text","name":"client_user","label":"Client username","value": user})
	result.push({"control":"password","name":"client_password","label":"Client password","value": password})
	return result
}

MQTTPlatform.prototype.saveSettings = function(settings) {
	var that = this

	if (settings.broker_host) {
		this.configuration.setValueForPlugin(this.name,"broker_host",settings.broker_host) 
	}

	if (settings.client_user) {
		this.configuration.setValueForPlugin(this.name,"client_user",settings.client_user) 
	}
	
	if (settings.client_password) {
		this.configuration.setValueForPlugin(this.name,"client_password",settings.client_password) 
	}
	
    this.loadDevices();
	this.initMqttConnection();
}


   
MQTTPlatform.prototype.loadDevices = function () {

  this.devices = []
  let that = this  
  var odev = this.configuration.getValueForPlugin(this.name,'devices')
  try {
	odev.forEach(function(device){
		let type = device['type']
		let serial = device['serial']
		let mqname = device['mqttdevice']
		if ((type) && (serial) && (mqname)) {
			that.log.info('Adding %s %s %s',type,serial,mqname)
			that.loadDevice(type,serial,mqname)
		}
	})
  } catch (e) {
	  this.log.error(e.stack);
  }
    
  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}


MQTTPlatform.prototype.loadServiceClazz = function(clazzType) {
	let fileName = path.join(__dirname,'serviceclasses',clazzType+'.js');
	if (fs.existsSync(fileName)) {
	    this.log.debug('Load BuildIn Service Class %s from %s',clazzType,fileName)
	    return require(path.join(__dirname,'serviceclasses',clazzType))
    } else {
	    this.log.error('No BuildIn Service Class found for %s at %s',clazzType,fileName)
    }

	return undefined
}

MQTTPlatform.prototype.loadDevice = function(type,serial,mqttName) {
	let settings = this.loadSettingsFor(type);
	if (settings) {
		let clazztype = settings['clazztype']
		var service = this.loadServiceClazz(clazztype)
		if (service != undefined) {
			let hmtype = settings['hmdevice']
			if (hmtype != undefined) {
				// Transfer the device date to core
				var devfile = path.join(__dirname, 'devices', type + '.json' )
				this.server.publishHMDevice(this.getName(),type,devfile,1)
				this.devices.push(new service(this,settings,serial,mqttName))
			}
		}
   	} else {
	   this.log.error('missing settingsfile for %s',type)	
   	}
}


MQTTPlatform.prototype.initMqttConnection = function() {
	
	if (this.mqttClient != undefined) {
		// Close connection
		this.mqttClient.end()
		this.topics = [];
	}
	var that = this
	
	var host = this.configuration.getValueForPlugin(this.name,'broker_host')

	if (host != undefined) {
		var user = this.configuration.getValueForPlugin(this.name,'client_user','')
		var password = this.configuration.getValueForPlugin(this.name,'client_password','')
		this.log.info('Init mqtt broker connection to %s',host)
		try {
			this.mqttClient = Mqtt.connect(host, {
			clientId: 'hvl_mqtt_' + Math.random().toString(16).substr(2, 8),
			will: {topic: this.name + '/connected', payload: '0', retain: true},
			username: user,	password: password
		}); 
   } catch (e) {
	   that.log.error(e.stack);
	   return;
   }
   
   
   this.mqttClient.on('connect', () => {
    that.mqttConnected = true
    that.log.debug('MQTT client connected')
    // Query all values
    that.devices.forEach(function(device){
	   device.queryState()
	 })
   })
   
   this.mqttClient.on('close', () => {
    that.mqttConnected = false;
    that.log.debug('MQTT client connection was closed')
	
   })
   
   this.mqttClient.on('offline', () => {
    that.log.warn('MQTT client connection is offline');
   });

   this.mqttClient.on('reconnect', () => {
    that.log.log.info('MQTT client connection reconnect');
   });
   
   
   this.mqttClient.on('message', (topic, payload) => {
    payload = payload.toString();
    that.log.debug('mqtt message %s %s', topic, payload);
	    this.devices.forEach(function(device){
			device.getTopicsToSubscribe().forEach(function(d_topic){
				if (topic.startsWith(d_topic)) {
					device.handleMqttMessage(topic,payload);
				}
			})
		})
   })
   
   
   this.devices.forEach(function(device){
	   device.getTopicsToSubscribe().forEach(function(topic){
	   	that.mqttClient.subscribe(topic + "/#");
	   	that.log.debug('mqtt subscribe %s', topic);
   	   })
   })
   
   this.mqttClient.publish('presence', 'HVL MQTT plugin is alive')
   }
}

MQTTPlatform.prototype.shutdown = function() {
    this.log.info("Shutdown")
 	this.bridge.deleteDevicesByOwner(this.name)
    this.mqttClient.publish('presence', 'HVL MQTT plugin shutdown')
    this.mqttClient.end()
}


MQTTPlatform.prototype.loadSettingsFor = function (devicetype) {

	let configFile = __dirname + '/devices/' + devicetype + '.json'
	this.log.info('try to load config : %s',configFile)
    if (fs.existsSync(configFile)) {
    	var buffer = fs.readFileSync(configFile);
        let result = JSON.parse(buffer.toString());
		return result;
	}
	return undefined;
}

MQTTPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);

  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  }

  this.devices.forEach(function(device) { 
		deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{
			'device_hmdevice': device.serial,
			'device_name': device.mqtt_device,
			'device_type': device.type,
		})
	})
	
  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = MQTTPlatform
