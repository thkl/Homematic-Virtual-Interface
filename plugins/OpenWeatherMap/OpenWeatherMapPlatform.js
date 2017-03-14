'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')

function OpenWeatherMapPlatform (plugin, name, server, log, instance) {
  OpenWeatherMapPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(OpenWeatherMapPlatform, HomematicVirtualPlatform)

OpenWeatherMapPlatform.prototype.init = function () {
  this.hmDevice = new HomematicDevice(this.getName())
  this.hmDevice.initWithType('KS500', 'OpenWeather')
  this.bridge.addDevice(this.hmDevice)
  this.plugin.initialized = true
  this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings")
  this.log.info('initialization completed %s', this.plugin.initialized)
  this.fetchWeather()
}

OpenWeatherMapPlatform.prototype.shutdown = function() {
	this.log.debug("OpenWeatherMapPlatform Plugin Shutdown");
	try {
		clearTimeout(this.refreshTimer);
	} catch (e) {
		this.log.error("Shutown error %s",e.stack)
	}
}


OpenWeatherMapPlatform.prototype.showSettings = function(dispatched_request) {
	var result = []
	this.localization.setLanguage(dispatched_request);
	var api_key = this.config.getValueForPlugin(this.name,'api_key')
	var locationId = this.config.getValueForPlugin(this.name,'locationId')
	
	result.push({'control':'text','name':'api_key',
		'label':this.localization.localize('OpenWeatherMap AppId'),
		'value':api_key,
		'description':this.localization.localize('register your app id at http://openweathermap.org/appid')
		})
	
	result.push({'control':'text','name':'locationId',
		'label':this.localization.localize('City ID/City Name'),
		'value':locationId,
		'description':this.localization.localize('see http://bulk.openweathermap.org/sample/city.list.json.gz for ID or you can try a name like Berlin,de')
		})
	
	
	return result
}

OpenWeatherMapPlatform.prototype.saveSettings = function(settings) {
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

OpenWeatherMapPlatform.prototype.fetchWeather = function () {
	
	var that = this
	var rainCond = [200,201,202,230,231,232,300,301,302,310,311,312,313,314,321,500,510,502,503,504,511,520,521,522,531]
	var api_key = this.config.getValueForPlugin(this.name,'api_key')
	var locationId = this.config.getValueForPlugin(this.name,'locationId')
	if ((api_key) && (locationId)) {
	var myutil = require(path.join(appRoot, 'Util.js'))
	var parameter = {'units':'metric','APPID':api_key}
	
	if (isNaN(locationId)) {
		parameter['q'] = locationId
	} else {
		parameter['id'] = locationId
	}
	
	 myutil.httpCall('GET','http://api.openweathermap.org/data/2.5/weather',parameter,function (result, error) {
		 
		 if (result) {
			 try {
				var jso = JSON.parse(result)
				var channel = that.hmDevice.getChannelWithTypeAndIndex('WEATHER','1')
				if (channel) {
					that.log.info('Fetch Weather cur Temp is %s',jso.main.temp)
					channel.updateValue('TEMPERATURE',jso.main.temp,true)
					channel.updateValue('HUMIDITY',jso.main.humidity,true)
					if (jso.rain) {
						channel.updateValue('RAIN_COUNTER',(jso.rain['3h'])? jso.rain['3h'] :0,true)
					} else {
						channel.updateValue('RAIN_COUNTER',0,true)
					}
					
					if (rainCond.indexOf(jso.weather[0].id)>-1) {
						channel.updateValue('RAINING',true,true)
					} else {
						channel.updateValue('RAINING',false,true)
					}
					
					channel.updateValue('WIND_SPEED',(jso.wind.speed*3.6),true) // its m/s in WeatherAPI but km/h in CCU
					channel.updateValue('WIND_DIRECTION',jso.wind.deg,true)
					
					channel.updateValue('WIND_DIRECTION_RANGE',0,true)
					channel.updateValue('SUNSHINEDURATION',0,true)
					channel.updateValue('BRIGHTNESS',0,true)
				}
				 
			 } catch (e) {
				 that.log.error('Unable to parse weather %s',e)
			 }
			 
			 
		 }
		 /* 
			 Mapping : 
			 1:TEMPERATURE -> main.temp
			 1:HUMIDITY -> main.humidity
			 1:RAINING -> weather[0].id -> 200,201,202,230,231,232,300,301,302,310,311,312,313,314,321,500,510,502,503,504,511,520,521,522,531
			 1:RAIN_COUNTER -> rain.3h
			 1:WIND_SPEED -> wind.speed
			 1:WIND_DIRECTION -> wind.deg
			 1:WIND_DIRECTION_RANGE -> n/a
			 1:SUNSHINEDURATION -> n/a
			 1:BRIGHTNESS -> n/a
		 */
	 })
	 
	 that.refreshTimer = setTimeout(function () {that.fetchWeather()}, 900000); // 15min
	 
	}
}

OpenWeatherMapPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

module.exports = OpenWeatherMapPlatform
