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
  // Check my SubFolder 
  this.personal_devpath = path.join(this.configuration.storagePath() , 'mqtt_dev');
  var myutil = require(path.join(appRoot, 'Util.js'));
  myutil.createPathIfNotExists(this.personal_devpath)
  myutil.createPathIfNotExists(path.join(this.personal_devpath),'hmdata')

  this.loadDevices();
  this.initMqttConnection();
}
   
MQTTPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []

	var host = this.configuration.getValueForPlugin(this.name,'broker_host')
	var user = this.configuration.getValueForPlugin(this.name,'client_user')
	var password = this.configuration.getValueForPlugin(this.name,'client_password')


	result.push({'control':'text','name':'broker_host','label':'Url of your MQTT Broker','value':host})
	result.push({'control':'text','name':'client_user','label':'Client username','value': user})
	result.push({'control':'password','name':'client_password','label':'Client password','value': password})
	return result
}

MQTTPlatform.prototype.saveSettings = function(settings) {
	var that = this

	if (settings.broker_host) {
		this.configuration.setValueForPlugin(this.name,'broker_host',settings.broker_host) 
	}

	if (settings.client_user) {
		this.configuration.setValueForPlugin(this.name,'client_user',settings.client_user) 
	}
	
	if (settings.client_password) {
		this.configuration.setValueForPlugin(this.name,'client_password',settings.client_password) 
	}
	
    this.loadDevices()
	this.initMqttConnection()
	this.plugin.initialized = true
	this.log.info('initialization completed %s', this.plugin.initialized)
}


   
MQTTPlatform.prototype.loadDevices = function () {

  this.devices = []
  let that = this  
  var odev = this.configuration.loadPersistentObjektfromFile('mqtt_objects')
  if (odev) {
	  
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
  }
    
}


MQTTPlatform.prototype.loadServiceClazz = function(clazzType) {
	var fileName = path.join(__dirname,'serviceclasses',clazzType) + '.js';
	if (fs.existsSync(fileName)) {
		this.log.debug('use build in dev path %s',fileName)
	    return require(fileName)
    } 
    
    fileName = path.join(this.personal_devpath,clazzType) + '.js';
	if (fs.existsSync(fileName)) {
		this.log.debug('use personal dev path %s',fileName)
	    return require(fileName)
    } 
    
    
    this.log.error('No BuildIn Service Class found for %s at %s',clazzType,fileName)
    return undefined
}

MQTTPlatform.prototype.loadDevice = function(type,serial,mqttName) {
	this.log.debug('Loading device %s with serial %s und mqtt name %s',type,serial,mqttName)
	let settings = this.loadSettingsFor(type);
	if (settings) {
		let clazztype = settings['clazztype']
		var service = this.loadServiceClazz(clazztype)
		if (service != undefined) {
			this.log.debug('servic clazz found for %s',clazztype)
			let hmtype = settings['hmdevice']
			if (hmtype != undefined) {
				this.log.debug('hmtype found for %s',hmtype)
				var devicefound = false
				// Transfer the device date to core
				var devfilebi = path.join(__dirname, 'devices', 'hmdata',hmtype + '.json' )
				if (fs.existsSync(devfilebi)) {
					this.log.debug('found dev in build in  %s',devfilebi)
					this.server.publishHMDevice(this.getName(),hmtype,devfilebi,2)
					let sc = new service(this,settings,serial,mqttName)
					sc.ctype = type
					console.log(sc.mqtt_device)
					this.devices.push(sc)
					devicefound = true
				} 
				// Try personal file
				var devfilecs = path.join(this.personal_devpath,'hmdata',hmtype + '.json' )
				if (fs.existsSync(devfilecs)) {
					this.server.publishHMDevice(this.getName(),hmtype,devfilecs,2)
					let sc = new service(this,settings,serial,mqttName)
					sc.ctype = type
					this.devices.push(sc)
					devicefound = true
				}
				
				if (devicefound == false) {
					this.log.error('missing device file %s or %s',devfilebi,devfilecs)	
				}
				
			} else {
				this.log.error('missing hmtype %s',hmtype)	
			}
		} else {
			this.log.error('missing service clazz for %s',clazztype)	
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
	this.clientID = 'hvl_mqtt_' + this.configuration.getMacAddress().toString().replace(/:/g,'')
	var host = this.configuration.getValueForPlugin(this.name,'broker_host')

	if (host != undefined) {
		var user = this.configuration.getValueForPlugin(this.name,'client_user','')
		var password = this.configuration.getValueForPlugin(this.name,'client_password','')
		this.log.info('Init mqtt broker connection to %s',host)
		try {
			this.mqttClient = Mqtt.connect(host, {
			clientId: that.clientID,
			will: {topic: 'tele/' + that.clientID + '/LWT', payload: 'offline', retain: true},
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
	that.mqttClient.publish('tele/' + that.clientID + '/LWT', 'online')

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
	   	that.mqttClient.subscribe(topic + '/#');
	   	that.log.debug('mqtt subscribe %s', topic);
   	   })
   })
   
   }
}

MQTTPlatform.prototype.shutdown = function() {
    this.log.info('Shutdown')
 	this.bridge.deleteDevicesByOwner(this.name)
    this.mqttClient.publish('presence', 'HVL MQTT plugin shutdown')
    this.mqttClient.end()
}


MQTTPlatform.prototype.deviceWithName = function(deviceName) {
    var result = undefined
    
    this.devices.forEach(function(device) { 
	    if (device.mqtt_device == deviceName) {
		    result = device
	    }
	})
	return result	    
}

MQTTPlatform.prototype.deviceWithHmSerial = function(deviceSerial) {
    var result = undefined
    
    this.devices.forEach(function(device) { 
	    if (device.serial == deviceSerial) {
		    result = device
	    }
	})
	return result	    
}


MQTTPlatform.prototype.saveDevices = function() {
    var result = []
    
    this.devices.forEach(function(device) { 
		result.push({'type':device.ctype,'serial':device.serial,'mqttdevice':device.mqtt_device})
	})
	this.log.debug('object %s',JSON.stringify(result))
	this.configuration.savePersistentObjektToFile(result,'mqtt_objects')
}

MQTTPlatform.prototype.removeDeviceWithSerial = function(deviceSerial) {
	var idx = -1
	var i = 0
	this.devices.forEach(function(device) { 
	    if (device.serial == deviceSerial) {
		    idx = i
	    }
	    i = i + 1
	})
	
	if (idx > -1) {
	   this.devices.splice(idx, 1);
    }
}

MQTTPlatform.prototype.loadDeviceTypes = function () {
	var result = [];
	var devdir = path.join(__dirname, 'devices')
	var privatedevdir = this.personal_devpath
	let that = this;
	try {  
		var data = fs.readdirSync(devdir);
		
		data.sort().forEach(function (file) {
			if (file.match(/\.(json)$/)) {
				result.push(file.replace(/\.[^/.]+$/, ''));
			}
  		});

  		
  		data = fs.readdirSync(privatedevdir);
  		data.sort().forEach(function (file) {
  			if (file.match(/\.(json)$/)) {
  				list.push(file.replace(/\.[^/.]+$/, ''));
	  		}
	  	});

  } catch (e) {
	  this.log.error('Error while loading Device Config List %s',e.stack);
  }
  return result;

}


MQTTPlatform.prototype.loadSettingsFor = function (devicetype) {

	var configFile = path.join(__dirname , 'devices' , devicetype + '.json')
	this.log.info('try to load config : %s',configFile)
    if (fs.existsSync(configFile)) {
    	var buffer = fs.readFileSync(configFile);
        let result = JSON.parse(buffer.toString());
		return result;
	}

	configFile = path.join(this.personal_devpath , devicetype + '.json')
	this.log.info('try to load personal config : %s',configFile)
    if (fs.existsSync(configFile)) {
    	var buffer = fs.readFileSync(configFile);
        let result = JSON.parse(buffer.toString());
		return result;
	}
	
	
	return undefined;
}

MQTTPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  let that = this
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , 'list_device_tmp.html',null);
  var fallback = true
  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
          fallback = false
        }
        break
		
		
	  case 'edit':
	  {
		template = 'edit.html'
		let dserial = queryObject['serial']
		let device = this.deviceWithHmSerial(dserial)
		let dtypelist = ''
		let dev_type_listItem = dispatchedRequest.getTemplate(this.plugin.pluginPath , 'dev_type_listItem.html',null);
	  	var dtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , 'edit_device_tmp.html',null);
	  	this.loadDeviceTypes().forEach(function (dt){
	  		let sel = (dt == device.ctype) ? 'selected=selected' : ''
			dtypelist = dtypelist + dispatchedRequest.fillTemplate(dev_type_listItem,{'type': dt,'isSelected':sel});
	  	})
		deviceList = deviceList + dispatchedRequest.fillTemplate(dtemplate,{'device_hmdevice': device.serial,'device_name': device.mqtt_device,'device_type': dtypelist});
          fallback = false
	  }
	  break
	  
	  
	  case 'new':
	  {
		template = 'edit.html'
		let dev_type_listItem = dispatchedRequest.getTemplate(this.plugin.pluginPath , 'dev_type_listItem.html',null);
	  	var dtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , 'edit_device_tmp.html',null);
		let dtypelist = ''
	  	this.loadDeviceTypes().forEach(function (dt){
			dtypelist = dtypelist + dispatchedRequest.fillTemplate(dev_type_listItem,{'type': dt,'isSelected':''});
	  	})
		deviceList = deviceList + dispatchedRequest.fillTemplate(dtemplate,{'device_hmdevice': 'new','device_name': '','device_type':dtypelist});
          fallback = false
	  }
	  break

	 case 'delete':
	  {
		let dserial = queryObject['serial']
		this.removeDeviceWithSerial(dserial)
		this.saveDevices()
		this.loadDevices()
	  }
	  break

    }
    
  }
  
  if (dispatchedRequest.post != undefined) {
  		
  	switch (dispatchedRequest.post['do']) {

  	case 'save':
	  {
		this.log.debug('saving objects')
		let device_hmdevice = dispatchedRequest.post['device_hmdevice'];
		let device_name = dispatchedRequest.post['device_name'];
		let device_type = dispatchedRequest.post['device_type'];
		
		if (device_hmdevice == 'new') {
			this.log.debug('create a new object')
			device_hmdevice = 'MQTT_' + String(this.devices.length + 1)
			this.log.debug('serial is %s',device_hmdevice)
			this.loadDevice(device_type,device_hmdevice,device_name)
		} else {
			let device = this.deviceWithHmSerial(device_hmdevice)
			if (device != undefined) {
				this.log.debug('object found save')
				device.mqtt_device = device_name
				device.ctype = device_type
			}
		}
		this.log.debug('saving devices')
		this.saveDevices()
		this.loadDevices()
	  }
	
	}
  
  }
  
  if (fallback == true) {
	  	  {
	  	this.devices.forEach(function(device) { 
			deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{
			'device_hmdevice': device.serial,
			'device_name': device.mqtt_device,
			'device_type': device.type,
			})
		})
	  }

  }

	
  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = MQTTPlatform
