'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot,'..','..','..','node_modules','homematic-virtual-interface','lib')}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')

function WeatherUndergroundPlatform (plugin, name, server, log, instance) {
  WeatherUndergroundPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(WeatherUndergroundPlatform, HomematicVirtualPlatform)

WeatherUndergroundPlatform.prototype.init = function () {
  this.hmDevice = new HomematicDevice('Wunderground')
  this.hmDevice.initWithType('KS500', 'Wunderground')
  this.bridge.addDevice(this.hmDevice)
  this.plugin.initialized = true
  this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings")
  this.log.info('initialization completed %s', this.plugin.initialized)
  this.fetchWeather()
}

WeatherUndergroundPlatform.prototype.shutdown = function() {
	this.log.debug("WeatherUndergroundPlatform Plugin Shutdown");
	try {
		clearTimeout(this.refreshTimer);
	} catch (e) {
		this.log.error("Shutown error %s",e.stack)
	}
}


WeatherUndergroundPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []
	this.localization.setLanguage(dispatched_request);
	var api_key = this.config.getValueForPlugin(this.name,'api_key')
	var locationId = this.config.getValueForPlugin(this.name,'locationId')
	
	result.push({'control':'text','name':'api_key',
		'label':this.localization.localize('WeatherUnderground API Key'),
		'value':api_key,
		'description':this.localization.localize("register your app key at <a target=_blank href='https://www.wunderground.com/?apiref=1f87d9e5008720ad'>https://www.wunderground.com/</a>")
		})
	
	result.push({'control':'text','name':'locationId',
		'label':this.localization.localize('Station ID'),
		'value':locationId,
		'description':this.localization.localize('see https://www.wunderground.com/wundermap for StationID')
		})
	
	
	return result
}

WeatherUndergroundPlatform.prototype.saveSettings = function(settings) {
	var that = this
	if (settings.api_key) {
		this.config.setValueForPlugin(this.name,'api_key',settings.api_key)
	}
	if (settings.locationId) {
		this.config.setValueForPlugin(this.name,'locationId',settings.locationId)
	}
	
	clearTimeout(that.refreshTimer);
	this.fetchWeather();
}

WeatherUndergroundPlatform.prototype.fetchWeather = function () {
	
	var that = this
	var api_key = this.config.getValueForPlugin(this.name,'api_key')
	var locationId = this.config.getValueForPlugin(this.name,'locationId')
	if ((api_key) && (locationId)) {
	var url = 'http://api.wunderground.com/api/%api_key%/conditions/lang:DL/q/pws:%station_id%.json'
	var parameter
	var myutil = require(path.join(appRoot, 'Util.js'))
	var rainCond = ['rain','flurries','sleet','snow','tstorms']
	
	url = url.replace('%api_key%', api_key)
	url = url.replace('%station_id%', locationId)
	
	
	 myutil.httpCall('GET',url,parameter,function (result, error) {
		 
		 if (result) {
			 try {
				var jso = JSON.parse(result)
				var observation = jso.current_observation
				var channel = that.hmDevice.getChannelWithTypeAndIndex('WEATHER','1')
				if (channel) {
					channel.updateValue('TEMPERATURE',observation.temp_c,true)
					var hum = parseFloat(observation.relative_humidity.replace('%', ''))
					that.log.info('Fetch Weather cur Temp is %s Hum %s',observation.temp_c,hum)
					channel.updateValue('HUMIDITY',hum,true)
					if (observation.precip_today_metric) {
						channel.updateValue('RAIN_COUNTER',parseFloat(observation.precip_today_metric),true)
					} else {
						channel.updateValue('RAIN_COUNTER',0,true)
					}
					
					if (rainCond.indexOf(observation.icon)>-1) {
						channel.updateValue('RAINING',true,true)
					} else {
						channel.updateValue('RAINING',false,true)
					}
					
					channel.updateValue('WIND_SPEED',(observation.wind_kph),true)
					channel.updateValue('WIND_DIRECTION',observation.wind_degrees,true)
					
					channel.updateValue('WIND_DIRECTION_RANGE',0,true)
					channel.updateValue('SUNSHINEDURATION',0,true)
					channel.updateValue('BRIGHTNESS',0,true)
				}
				 
			 } catch (e) {
				 that.log.error('Unable to parse weather %s',e)
			 }
			 
			 
		 }
	 })
	 
	 that.refreshTimer = setTimeout(function () {that.fetchWeather()}, 900000); // 15min
	 
	}
}

WeatherUndergroundPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

module.exports = WeatherUndergroundPlatform
