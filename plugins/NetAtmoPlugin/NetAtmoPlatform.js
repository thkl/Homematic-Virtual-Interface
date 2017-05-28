//
//  NetAtmoPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 26.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


'use strict'

var HomematicDevice
var netatmo = require('netatmo')
var url = require('url')
var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) {appRoot =  appRoot+'/../lib'}
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot,'..','..','..','node_modules','homematic-virtual-interface','lib')}
appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
var util = require('util')


function NetAtmoPlatform(plugin,name,server,log,instance) {
	NetAtmoPlatform.super_.apply(this,arguments)
	this.bridge = server.getBridge()
	this.devices = []
	HomematicDevice = server.homematicDevice
}

util.inherits(NetAtmoPlatform, HomematicVirtualPlatform)



NetAtmoPlatform.prototype.init = function() {
	var that = this
	this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
	this.localization = require(appRoot + '/Localization.js')(__dirname + '/Localizable.strings')

	
	var auth = this.configuration.getValueForPlugin(this.name,'auth')
	if (auth != undefined) {
		var client_id =  auth['client_id']
		var client_secret = auth['client_secret']
		var username = auth['username']
		var password = auth['password']
	}

	if ((client_id == undefined) || (client_secret == undefined) || (username == undefined) || (password == undefined)) {
		this.log.error('Please setup your netatmo credentials in your config.json ... see ReadMe.')
	} else {
		this.connectApi(auth)
	}
}

NetAtmoPlatform.prototype.connectApi = function(auth) {
this.log.info('Connecting to netatmo Service.')
auth['scope'] = 'read_station read_thermostat'
var api = new netatmo(auth)
var i = 0
var that = this		

var NA_Main = require(__dirname + '/NA_Main.js').NA_Main
var NA_Module1 = require(__dirname + '/NA_Module1.js').NA_Module1
var NA_Module4 = require(__dirname + '/NA_Module4.js').NA_Module4
var NA_ComboModule = require(__dirname + '/NA_ComboModule.js').NA_ComboModule

api.getStationsData(function(err, devices) {
	that.log.debug("JSON :%s",JSON.stringify(devices))
	devices.forEach(function (device) {
		var hazCombo = false
		var nadevice = new NA_Main(that,api,device,'NAT00'+i)
		that.devices.push(nadevice)
		i = i + 1
		device.modules.forEach(function (module) {
			that.log.debug('Create new Module %s', module['module_name'])
			
			// Check if we have a NAModule2 or NAModule3
			var mm = that.hazMultiModulez(device)
			if (mm['m1'] && ( mm['m2'] || mm['m3']) && (hazCombo==false)) {
				var nam = new NA_ComboModule(that,api,device,mm['m1'] , mm['m2'] , mm['m3'], 'NA00C'+ i)
				that.devices.push(nam)
				hazCombo = true
				i = i + 1
			} else {
			
			if (module['type']=='NAModule1') {
				var nam = new NA_Module1(that,api,device,module,'NA00M'+ i)
				that.devices.push(nam)
				i = i + 1
			}
			
			}
			if (module['type']=='NAModule4') {
				var nam = new NA_Module4(that,api,device,module,'NA00M'+ i)
				that.devices.push(nam)
				i = i + 1
			}
		})
	})
	
   that.refresh()	
})

api.on('error', function(error) {
    // When the 'error' event is emitted, this is called
    that.log.error('Netatmo threw an error: ' + error)

    setTimeout(function() {
	    that.connectApi(auth)
    }, 90000)

})

api.on('warning', function(error) {
    // When the 'warning' event is emitted, this is called
    that.log.warn('Netatmo threw a warning: ' + error)
    
})

}

NetAtmoPlatform.prototype.hazMultiModulez = function(device) {
	var result = {}
	
	device.modules.forEach(function (module) {
		
		if (module['type']=='NAModule1') {
			result['m1'] = module
		}
		
		if (module['type']=='NAModule2') {
			result['m2'] = module
		}
		
		if (module['type']=='NAModule3') {
			result['m3'] = module
		}
	})
	
	return result
}


NetAtmoPlatform.prototype.refresh = function() {
	this.devices.forEach(function (device){
		device.refreshDevice()
	})
	var that = this
	var refreshrate = this.configuration.getPersistValueForPluginWithDefault(this.plugin.name,'refresh',360)*1000
		if (refreshrate < 120000) {
			refreshrate = 120000
		}
		
		this.updateTimer = setTimeout(function() {
		 	that.refresh()
		}, refreshrate)
}

NetAtmoPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request)
	var result = []
	var client_id = ''
	var client_secret = ''
	var username = ''
	var password = ''
	
	var auth = this.configuration.getValueForPlugin(this.name,'auth')

	if (auth != undefined) {
		client_id =  auth['client_id'] || ''
		client_secret = auth['client_secret']  || ''
		username = auth['username'] || ''
		password = auth['password'] || ''
	} 
	
	result.push({'control':'text','name':'client_id','label':this.localization.localize('Client ID'),'value':client_id,'size':30})
	result.push({'control':'password','name':'client_secret','label':this.localization.localize('Client Secret'),'value':client_secret,'size':30})
	result.push({'control':'text','name':'username','label':this.localization.localize('Username'),'value':username,'size':30})
	result.push({'control':'password','name':'password','label':this.localization.localize('Password'),'value':password,'size':30})
	
	return result
}

NetAtmoPlatform.prototype.saveSettings = function(settings) {
	var that = this
	
	if  ((settings.client_id) && (settings.client_secret) && (settings.username) && (settings.password))  {
		var auth = {'client_id':settings.client_id,
					'client_secret':settings.client_secret,
					'username':settings.username,
					'password':settings.password}
		this.configuration.setValueForPlugin(this.name,'auth',auth) 
		this.removeMyDevices()
		this.connectApi(auth)
	}
}

NetAtmoPlatform.prototype.removeMyDevices = function() {
  var that = this
  this.hm_layer.deleteDevicesByOwner(this.plugin.name)
}

NetAtmoPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var strDevice = ''
	var that = this
	var devicetemplate = dispatched_request.getTemplate(this.plugin.pluginPath , 'list_device_tmp.html',null)
    this.devices.forEach(function (device){
	   strDevice = strDevice + dispatched_request.fillTemplate(devicetemplate,{'device_name':device.name,'device_hmdevice':device.hm_device_name})
    })
    
    if (dispatched_request.post != undefined) {
	
	    this.log.debug(JSON.stringify(dispatched_request.post))
	
		switch (dispatched_request.post['do']) {
			
			
			case 'settings.save':
			{
				var CO2_ADDED = dispatched_request.post['settings.co2_added']
				var CO2_ADDED_STRONG = dispatched_request.post['settings.co2_strong']
				var refresh = dispatched_request.post['settings.refresh']

				this.configuration.setPersistValueForPlugin(this.name,'refresh',refresh) 
				this.configuration.setPersistValueForPlugin(this.name,'CO2_ADDED',CO2_ADDED) 
				this.configuration.setPersistValueForPlugin(this.name,'CO2_ADDED_STRONG',CO2_ADDED_STRONG) 
			}
			break	
		}
	}
    
    var lvlAdded = this.configuration.getPersistValueForPluginWithDefault(this.name,'CO2_ADDED',1000)
	var lvlStrong = this.configuration.getPersistValueForPluginWithDefault(this.name,'CO2_ADDED_STRONG',1400)
	var refresh = this.configuration.getPersistValueForPluginWithDefault(this.name,'refresh',360)

	dispatched_request.dispatchFile(this.plugin.pluginPath , 'index.html',{'listDevices':strDevice,
		'settings.co2_added':lvlAdded,
		'settings.refresh':refresh,
		'settings.co2_strong':lvlStrong})
}


module.exports = NetAtmoPlatform