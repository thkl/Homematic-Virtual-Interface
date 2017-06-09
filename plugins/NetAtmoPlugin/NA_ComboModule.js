var HomematicDevice;
const NetAtmoDevice = require(__dirname + '/NetAtmoDevice.js').NetAtmoDevice
const url = require('url')
const path = require('path')
const util = require('util')

var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) {appRoot =  appRoot+'/../lib'}
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot,'..','..','..','node_modules','homematic-virtual-interface','lib')}
appRoot = path.normalize(appRoot)

const HomematicReqaRequest = require(appRoot + '/HomematicReqaRequest.js')


var NA_ComboModule = function(plugin, netAtmoApi ,naDevice,module1,module2,module3,serialprefix) {

	var that = this
	this.api =  netAtmoApi
	this.log = plugin.log
	this.plugin = plugin
	this.configuration = plugin.configuration
	this.bridge = plugin.server.getBridge()
	this.deviceId = naDevice['_id']
	this.naId1 = module1['_id']
	this.naId2 = module2 ? module2['_id']:undefined
	this.naId3 = module3 ? module3['_id']:undefined
	
	var HomematicDevice = plugin.server.homematicDevice

	this.hmModule = new HomematicDevice(that.plugin.getName())
	var data = this.bridge.deviceDataWithSerial(this.naId1)
	if (data != undefined) {
		this.hmModule.initWithStoredData(data)
	}
	
	if (this.hmModule.initialized === false) {
		this.hmModule.initWithType('KS500', serialprefix);
		this.hmModule.firmware = naDevice['firmware']
		this.bridge.addDevice(this.hmModule,true)
	} else {
		this.bridge.addDevice(this.hmModule,false)
	}
	
	this.hm_device_name = 'KS500'+ serialprefix
}

util.inherits(NA_ComboModule, NetAtmoDevice);

NA_ComboModule.prototype.refreshDevice = function() {
	  var that = this
	  this.log.debug('Refresh NetAtmo NA_ComboModule(KS500) with id %s',this.naId)
	  // Get Module 1 Data
	  
	  var options = {device_id: this.deviceId ,module_id:this.naId1, date_end :'last', scale: 'max',type: ['Temperature','Humidity']}
	  this.api.getMeasure(options, function(err, measure) {
		  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]['value']
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var channel = that.hmModule.getChannelWithTypeAndIndex('WEATHER','1')
			  			if (channel != undefined) {
		  					that.parseModule1Data(lastMeasure[0],channel)
			  				}
						}
					}
					
		})
		
		if (this.naId2) {
		options = {device_id: this.deviceId ,module_id:this.naId2, date_end :'last', scale: 'max',type: ['WindStrength','WindAngle']}
		this.api.getMeasure(options, function(err, measure) {
		  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]['value']
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var channel = that.hmModule.getChannelWithTypeAndIndex('WEATHER','1')
			  			if (channel != undefined) {
		  					that.parseModule2Data(lastMeasure[0],channel)
			  				}
						}
					}
					
		})
		}

		if (this.naId3) {
	  options = {device_id: this.deviceId ,module_id:this.naId3, date_end :'last', scale: 'max',type: ['Rain']}
	  this.api.getMeasure(options, function(err, measure) {
		  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]['value']
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var channel = that.hmModule.getChannelWithTypeAndIndex('WEATHER','1')
			  			if (channel != undefined) {
		  					that.parseModule3Data(lastMeasure[0],channel)
			  				}
						}
					}
					
		});
		
		// Check the Dashboard if we have a rain varialbe
		var rain_ccu_var = this.configuration.getValueForPlugin(this.plugin.name,'ccu_rain')
		
		if (rain_ccu_var) {
			options = {device_id: this.deviceId}
			this.api.getStationsData(options,function(err, devices) {
				devices.some(function(device){
					device.modules.some(function (module) {
						if (module._id == that.naId3) {
							var script = "dom.GetObject('"+rain_ccu_var+"').State("+module.dashboard_data.sum_rain_24+");"
						    new HomematicReqaRequest(that.bridge,script,function(response){

						    })
						}
					})
				  })
				})
		}
		
		}
		
		var channel = that.hmModule.getChannelWithTypeAndIndex('WEATHER','1')
		
		// Check the Dashboard if we have a rain varialbe
		var ccu_bright = this.configuration.getValueForPlugin(this.plugin.name,'ccu_bright')
		var ccu_bright_factor = this.configuration.getValueForPluginWithDefault(this.plugin.name,'ccu_bright_factor',1) 
		if (ccu_bright) { 
			var script = "Write(dom.GetObject('"+ccu_bright+"').State());"
				new HomematicReqaRequest(that.bridge,script,function(response){
					var br = parseFloat(response)
					var nbr = (br * ccu_bright_factor).toFixed();
					that.log.debug("Math for brightness %s * %s = %s",br,response,nbr)
					channel.updateValue('BRIGHTNESS',nbr,true,true)
				})
		}

		var ccu_sunshine = this.configuration.getValueForPlugin(this.plugin.name,'ccu_sunshine')
		var ccu_sunshine_factor = this.configuration.getValueForPluginWithDefault(this.plugin.name,'ccu_sunshine_factor',1) 
		if (ccu_sunshine) { 
			var script = "Write(dom.GetObject('"+ccu_sunshine+"').State());"
				new HomematicReqaRequest(that.bridge,script,function(response){
					var sh = parseFloat(response)
					var shr = (sh * ccu_sunshine_factor).toFixed();
					that.log.debug("Math for sunshine %s,%s",response,shr)
					channel.updateValue('SUNSHINEDURATION',sh,true,true)
				})
		}
		
}


NA_ComboModule.prototype.parseModule1Data = function (measurement,channel) {
	var temp = measurement[0]
	var hum = measurement[1]
	channel.updateValue('TEMPERATURE',temp,true,true)
	channel.updateValue('HUMIDITY',hum,true,true)
}

NA_ComboModule.prototype.parseModule2Data = function (measurement,channel) {
	var windspeed = measurement[0]
	var windangle = measurement[1]
	channel.updateValue('WIND_SPEED',windspeed,true,true)
	channel.updateValue('WIND_DIRECTION',windangle,true,true)
}

NA_ComboModule.prototype.parseModule3Data = function (measurement,channel) {
	var rain = measurement[0]
	channel.updateValue('RAIN_COUNTER',rain,true,true)
	channel.updateValue('RAINING',(rain > 0),true)
}


module.exports = {
	  NA_ComboModule : NA_ComboModule
}
