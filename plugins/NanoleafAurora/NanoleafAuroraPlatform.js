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
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }
appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var AuroraApi = require(path.join(__dirname,'lib','aurora.js'))

function NanoleafAuroraPlatform (plugin, name, server, log, instance) {
  NanoleafAuroraPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(NanoleafAuroraPlatform, HomematicVirtualPlatform)

NanoleafAuroraPlatform.prototype.init = function () {
  var that = this
  this.localization = require(appRoot + '/Localization.js')(__dirname + '/Localizable.strings') 
  
  this.initApi()
  
  this.hmDevice = new HomematicDevice(this.getName())
  var devName = 'Aurora_' + ((this.instance) ? this.instance :'0')

  this.hmDevice.initWithType('HM-LC-RGBW-WM', devName)
  this.bridge.addDevice(this.hmDevice)

  // this will trigered when a value of a channel was changed by the ccu
  this.hmDevice.on('device_channel_value_change', function (parameter) {
    var newValue = parameter.newValue
    
    if (that.api) {
	    
    var channel = that.hmDevice.getChannel(parameter.channel)
    if (parameter.name === 'LEVEL') {
			if (newValue == 0) {
				that.log.debug("turnOff")
				that.api.turnOff().then(function(result) { 
					that.log.debug('Turned off with result %s',result)
					clearTimeout(that.refreshTimer)
					that.fetchValues()
				}).catch(function(err) {that.log.error('Turn Off Error %s',err)})
			} else {
				that.lastLevel = newValue

				that.log.debug('turnOn')
				that.api.turnOn().then(function(result) { 
					that.log.debug('Turned On with result %s',result)
					var newBrightness = Math.ceil(newValue*100)
					that.log.debug('setBrightness %s',newBrightness)
					that.api.setBrightness(newBrightness).then(function(bresult) {
						that.log.debug('setBrightness  with result %s',bresult)
						clearTimeout(that.refreshTimer)
						that.fetchValues()
					}).catch(function(err) {that.log.error('Set Bri Error %s',err)})
				}).catch(function(err) {that.log.error('Turn On Error %s',err)})
			}
	}

    
    if (parameter.name === 'OLD_LEVEL') {
			that.log.debug('turnOn - OLD_LEVEL')
			that.api.turnOn().then(function(result) { 
				that.log.debug('Turned On with result %s',result)
				if (that.lastLevel == 0) {
					  that.lastLevel = 1;
				}
				var newBrightness = Math.ceil(that.lastLevel*100)
				that.log.debug('setBrightness %s',newBrightness)
				that.api.setBrightness(newBrightness).then(function(bresult) {
					that.log.debug('setBrightness  with result %s',bresult)
					clearTimeout(that.refreshTimer)
					that.fetchValues()
				}).catch(function(err) {that.log.error('Set Bri Error %s',err)})
			}).catch(function(err) {that.log.error('Turn On Error %s',err)})
	}
    
    if (parameter.name == "COLOR") {
		var newHue = Math.ceil((newValue*360)/199)
		that.log.debug('setHue %s',newHue)
			that.api.setEffect('Static').then(function(result) {
				that.api.setHue(newHue).then(function(result) {
					 that.log.debug('setHue  with result %s',result)
				}).catch(function(err) {that.log.error('Set Hue Error %s',err)})
			}).catch(function(err) {that.log.error('Set Effect Error %s',err)})
	}

	if (parameter.name == "PROGRAM") {
		var progrId  = newValue
		if (progrId == 0) {
			that.log.debug('setEffect OFF');
			that.api.turnOff().then(function(result) { 
				that.log.debug('Turned off with result %s',result)
					clearTimeout(that.refreshTimer)
					that.fetchValues()
				}).catch(function(err) {that.log.error('Turn Off Error %s',err)})
		} else {
			if (that.effects.length>progrId) {
			var efname = that.effects[progrId]
			if (efname) {
				that.log.debug('setEffect to %s',efname)
				that.api.setEffect(efname).then(function(result) { 
				that.log.debug('setEffect with result %s',result)
					clearTimeout(that.refreshTimer)
					that.fetchValues()
				}).catch(function(err) {that.log.error('setEffect Error %s',err)})
				
				}
			}
		}
	}
	
    }
  })
  
  
  this.hmDevice.on('device_channel_install_test', function(parameter){
	  if (that.api) {
		that.api.identify().then(function() {}).catch(function(err) {that.log.error('Identification Error %s',err)})
		var channel = that.hmDevice.getChannel(parameter.channel)
		channel.endUpdating('INSTALL_TEST')
	  } else {
		that.log.error('Identification Error , API is not active')
	  }
  })
  
  if (this.api) {
	   this.fetchValues()
  }
  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}


NanoleafAuroraPlatform.prototype.shutdown = function() {
    this.log.info('Shutdown')
 	this.bridge.deleteDevicesByOwner(this.name)
	clearTimeout(this.refreshTimer)
}


NanoleafAuroraPlatform.prototype.initApi = function() {
	var nbip = this.config.getValueForPlugin(this.name,'ip')
	var token = this.config.getValueForPlugin(this.name,'token')
    var that = this
    
    var pluginEfectList = this.config.getValueForPlugin(this.name,'effects')
	this.effectList = ["Color Burst",
"Farbe & Bunt","Fireplace","Flames","Forest","Inner Peace","Nemo","Northern Lights","Romantic","Snowfall","Sunset"]

	this.effects = [];
	this.effects.push('off');
	
	if (pluginEfectList) {
		pluginEfectList.split(",").some(function (efname){
			that.effects.push(efname)
		})
	}
	    
    var that = this
	if (nbip) {
		this.api = new AuroraApi({
  		  host: nbip,
  		  base: '/api/beta/',
  		  port: '16021',
  		  accessToken: that.token || 'dummy'
  		})
	}
 
  	if ((nbip) && (!that.token)) {
	  	this.generateToken()
    } else {
	    // fetch Info and generate List of available effects
	    this.api.getInfo().then(function (result) {
		    try {
			    var infoObject = JSON.parse(result)
			    if (infoObject) {
				    that.effectList = infoObject.effects.list
			    }
		    } catch (e) {
			    
		    }
		}).catch(function(err) {that.log.error('getInfo Error %s',err)})
    }

}

NanoleafAuroraPlatform.prototype.generateToken = function() {
	var that = this
	this.log.info('Holding the on-off button down for 5-7 seconds until the LED starts flashing in a pattern ')
	this.api.getToken().then(function(result){
		that.log.info('TokenResult : %s',result)
		try {
		  // result is like {"auth_token":"wFqJI0exC1oJjiuzzguholknjjz1m"} so parse that
		  var resultObject = JSON.parse(result)
		  if (resultObject) {
		  	var token = resultObject['auth_token']
			that.config.setValueForPlugin(that.name,'token',token)
			}
		} catch (err) {
			 that.log.error('error while parsing the token %s',err) 
		}
	  }).catch(function(err) {that.log.error('GetToken Error %s',err)})
}

NanoleafAuroraPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []
	this.localization.setLanguage(dispatched_request)
	var ip = this.config.getValueForPlugin(this.name,'ip')
	var token = this.config.getValueForPlugin(this.name,'token')
	
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
	
	
	return result
}

NanoleafAuroraPlatform.prototype.saveSettings = function(settings) {
	var that = this
	if (settings.ip) {
		this.config.setValueForPlugin(this.name,'ip',settings.ip)
	}
	if (settings.token) {
		this.config.setValueForPlugin(this.name,'token',settings.token)
	}

	clearTimeout(this.refreshTimer)
	this.initApi()
	this.fetchValues()
}

NanoleafAuroraPlatform.prototype.fetchValues = function () {
	var that = this
	try {
	if ((this.api) && (this.token)) {
		this.api.getHue().then(function (result){
			// add special for White (200) here !!
			var rgb = (result*199)/360
			
			that.log.debug('Aurora Hue is %s',result)
			var co_channel = that.hmDevice.getChannelWithTypeAndIndex('RGBW_COLOR','2')
			if (co_channel) {
				 co_channel.updateValue('COLOR',rgb,true,true)
			}
			
		}).catch(function(err) {that.log.error('getHue Error %s',err)})

		this.api.getColourTemperature().then(function (result){
			// add special for White     sat = 0 ?
			that.log.debug('Aurora ColourTemperature/Sat is %s',result)
		}).catch(function(err) {that.log.error('getColourTemperature Error %s',err)})
		
		var di_channel = this.hmDevice.getChannelWithTypeAndIndex('DIMMER','1');
		var pr_channel = this.hmDevice.getChannelWithTypeAndIndex('RGBW_AUTOMATIC','3');
		if ((di_channel) && (pr_channel)) {
		this.api.getPowerStatus().then(function (result) {
			that.log.debug('Aurora Power Status is %s',result)
			// {"value":true} oder {"value":false}
			var powerStatus = JSON.parse(result)
			var power = powerStatus["value"]
			if (power == false) {
				// Off is off so ignore the brightness and set it to zero
				di_channel.updateValue('LEVEL',0,true,true)
				pr_channel.updateValue('PROGRAM',0,true,true)
			} else {
				// Have to query brightness
				that.api.getBrightness().then(function(result){
					that.log.debug('Aurora Brightness is %s',result)
					// result looks like: {"value":18,"max":100,"min":0}
					var brightness = JSON.parse(result)
					var bri = Math.floor(brightness["value"])/100
					that.log.debug('HM Brightness will be set to %s',bri)
					that.lastLevel = bri
					di_channel.updateValue('LEVEL',bri,true,true)
				}).catch(function(err) {that.log.error('getBrightness Error %s',err)})
				
				// Check Effect 
				
				that.api.getEffect().then(function(result){
					that.log.debug('Aurora getEffect is %s',result)
					// result looks like: ????

				}).catch(function(err) {that.log.error('getEffect Error %s',err)})
				
			}
			
			
		}).catch(function(err) {that.log.error('getPowerStatus Error %s',err)})
		}
	} 
	} catch (error) {
		this.log.error('General fetch Error %s',error)
	} 
	this.refreshTimer = setTimeout(function() {that.fetchValues()}, 30000);
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
	   
	   case 'generateToken':
	   {
		   message = this.localization.localize('Holding the on-off button down for 5-7 seconds until the LED starts flashing in a pattern. Please use a clock to help because pressing the button more then 7 seconds may end up an a reset to defaults action.')
		   this.generateToken()
		}
		break 
    }
  }

  if (dispatchedRequest.post != undefined) {	
	 switch (dispatchedRequest.post['do']) {
		 
		case 'efx.save':
		{
			this.effects = [];
			this.effects.push('off')
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
	result.push({'id':this.hmDevice.serialNumber,'name':'NanoLeaf Light','type':'HUELIGHT'})
	return result
}

module.exports = NanoleafAuroraPlatform
