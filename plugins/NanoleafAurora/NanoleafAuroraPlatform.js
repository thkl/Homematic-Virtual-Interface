//
//  NanoleafAuroraPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 15.03.2017.
//  thanks to https://github.com/JensBonse for investigation on NanoLeaf Aurora ...
//
//  Copyright © 2016 kSquare.de. All rights reserved.
//

'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

const fs = require('fs')
if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}
appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var NanoLeafDevice = require(path.join(__dirname,'NanoLeafDevice.js'))

function NanoleafAuroraPlatform (plugin, name, server, log, instance) {
  NanoleafAuroraPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(NanoleafAuroraPlatform, HomematicVirtualPlatform)

NanoleafAuroraPlatform.prototype.init = function () {
	var that = this
	this.devices = []
	
	this.localization = require(appRoot + '/Localization.js')(__dirname + '/Localizable.strings') 
	var idz = 0
	var leafs = this.config.getValueForPlugin(this.name,'leafs')
	if (leafs != undefined) {
		leafs.forEach(function (leaf){
			let obj_leaf = new NanoLeafDevice(that,(leaf.name || idz))
			obj_leaf.init(leaf.ip,leaf.token)
			that.devices.push(obj_leaf)
			idz = idz + 1
		})
	}

	this.plugin.initialized = true
	this.log.info('initialization completed %s', this.plugin.initialized)
}


NanoleafAuroraPlatform.prototype.shutdown = function() {
    this.log.info('Shutdown')
 	this.bridge.deleteDevicesByOwner(this.name)
	clearTimeout(this.refreshTimer)
}



NanoleafAuroraPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []
	this.localization.setLanguage(dispatched_request)
	var refresh = this.config.getValueForPluginWithDefault(this.name,'refresh',30)

/*	
	result.push({'control':'text','name':'ip',
		'label':this.localization.localize('IP Adress'),
		'value':ip,
		'description':this.localization.localize('IP of your leaf')
		})
	
	result.push({'control':'text','name':'token',
		'label':this.localization.localize('Token'),
		'value':token,
		'description':this.localization.localize('Click <a href="/'+this.name+'?do=generateToken">here</a> to get a Token')
		})
*/

	result.push({'control':'text','name':'refresh',
		'label':this.localization.localize('Refresh'),
		'value':refresh,
		'description':this.localization.localize('Refresh state every xx seconds.')
		})
	
	
	return result
}

NanoleafAuroraPlatform.prototype.saveSettings = function(settings) {
	var that = this

	if (settings.refresh) {
		this.config.setValueForPlugin(this.name,'refresh',settings.refresh)
	}

	clearTimeout(this.refreshTimer)
	// Save all leafs
}



NanoleafAuroraPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
	var template = 'index.html'
	var requesturl = dispatchedRequest.request.url
	var queryObject = url.parse(requesturl, true).query
	var message = ''
	this.localization.setLanguage(dispatchedRequest)
  
	if (queryObject['do'] !== undefined) {
		switch (queryObject['do']) {
			case 'app.js':
			{
				template = 'app.js'
			}
			break
/*
			case 'generateToken':
			{
				message = this.localization.localize('Holding the on-off button down for 5-7 seconds until the LED starts flashing in a pattern. Please use a clock to help because pressing the button more then 7 seconds may end up an a reset to defaults action.')
				this.generateToken()
			}
			break 
*/
		}
	}

	if (dispatchedRequest.post != undefined) {	
		switch (dispatchedRequest.post['do']) {
			case 'efx.save':
			{
				this.effects = [];
				this.effects.push('*Static*')	// no effect -> *Static*
				var idx = 1
				while (idx < 7) {
					var efn = dispatchedRequest.post['exf.' + idx]
					this.effects.push(efn)
					idx = idx + 1
				}
				this.config.setValueForPlugin(this.name,'effects',this.effects.join(','))
			}
		}
	}
	var efxList = this.buildEffectList(dispatchedRequest)
	dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listEffects': efxList,'message':message})
}

NanoleafAuroraPlatform.prototype.myDevices = function() {
	// return my Devices here
	var result = []
	result.push({'id':'sep-hued','name':'--------- NanoLeaf Aurora ---------','type':'seperator'})

	this.devices.forEach(function (leaf){
		result.push({'id':leaf.hmDevice.serialNumber,'name':'NanoLeaf Light','type':'HUELIGHT'})
	})

	return result
}

NanoleafAuroraPlatform.prototype.buildEffectList = function(dispatched_request) {
	var idx = 1
	var listsresult = ''
	var template = dispatched_request.getTemplate(this.plugin.pluginPath , "list_efx_tmp.html",null)
	
	while (idx < 7) {
		var result = ''
		var selectedEffect = (this.effects.length>idx) ? this.effects[idx] : ''
		this.log.debug('SE for %s is %s',idx,selectedEffect)
		this.effectList.some(function (effectName){
		   result = result + '<option ' + ((effectName==selectedEffect) ? 'selected="selected"' : '') +'>'+ effectName +'</option>'	
		})
		listsresult = listsresult + dispatched_request.fillTemplate(template,{'efx.list':result,'efx.num':idx});
		idx = idx + 1
    }
    return listsresult
}

module.exports = NanoleafAuroraPlatform
