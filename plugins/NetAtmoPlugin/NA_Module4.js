var HomematicDevice;
var NetAtmoDevice = require(__dirname + "/NetAtmoDevice.js").NetAtmoDevice;
const url = require("url");
const path = require('path');
const util = require("util");



var NA_Module4 = function(plugin, netAtmoApi ,naDevice,module,serialprefix) {

	var that = this;
	this.api =  netAtmoApi;
	this.log = plugin.log;
	this.plugin = plugin;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.deviceId = naDevice["_id"];
	this.naId = module["_id"];
	var HomematicDevice = plugin.server.homematicDevice;

	this.hmModule = new HomematicDevice(that.plugin.getName());
	var data = this.bridge.deviceDataWithSerial(this.naId);
	if (data != undefined) {
		this.hmModule.initWithStoredData(data);
	}
	
	if (this.hmModule.initialized === false) {
		this.hmModule.initWithType("HM-WDS40-TH-I-2_NA", serialprefix);
		this.hmModule.firmware = naDevice["firmware"];
		this.bridge.addDevice(this.hmModule,true);
	} else {
		this.bridge.addDevice(this.hmModule,false);
	}
		this.hmModule.na_type = module["type"];
		
	this.hmCarbonDioxide = new HomematicDevice(this.plugin.getName());

	var data = this.bridge.deviceDataWithSerial(this.naId + "_C");
	if (data!=undefined) {
		this.hmCarbonDioxide.initWithStoredData(data);
	}

	if (this.hmCarbonDioxide.initialized === false) {
		this.hmCarbonDioxide.initWithType("HM-CC-SCD_NA", serialprefix + "2");
		this.hmCarbonDioxide.firmware = naDevice["firmware"];
		this.hmCarbonDioxide.serialNumber = this.naId + "_C";
		this.bridge.addDevice(this.hmCarbonDioxide,true);
	} else {
		this.bridge.addDevice(this.hmCarbonDioxide,false);
	}

	this.hm_device_name = "HM-WDS40-TH-I-2_NA "+ serialprefix + "1 / HM-CC-SCD " + serialprefix + "2";
}

util.inherits(NA_Module4, NetAtmoDevice);

NA_Module4.prototype.refreshDevice = function() {
	  var that = this;	
	  this.log.debug("Refresh NetAtmo NA_Module4 with id %s",this.naId);
	  var options = {device_id: this.deviceId ,module_id:this.naId, date_end :'last', scale: 'max',type: ['Temperature','Humidity','CO2']};
	  this.api.getMeasure(options, function(err, measure) {
		  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]["value"]
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var channel = that.hmModule.getChannelWithTypeAndIndex("WEATHER","1");
			  			var co2channel = that.hmModule.getChannelWithTypeAndIndex("SENSOR_FOR_CARBON_DIOXIDE","1");
			  			if (channel != undefined) {
		  					that.parseModuleData(lastMeasure[0],channel,co2channel)
			  				}
						}
					}
					
	});
}


NA_Module4.prototype.parseModuleData = function (measurement,channel,co2channel) {
	var temp = measurement[0]
	var hum = measurement[1]
	var co2 = measurement[3]
	var co2State = 0
	channel.updateValue("TEMPERATURE",temp,true,true)
	channel.updateValue("HUMIDITY",hum,true,true)


	var lvlAdded = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED",1000)
	var lvlStrong = this.configuration.getPersistValueForPluginWithDefault(this.name,"CO2_ADDED_STRONG",1400)
				
	if (co2 > lvlAdded) {
		 co2State = 1
	}
	
	if (co2 > lvlStrong) {
		co2State = 2
	}
	
	co2channel.updateValue("STATE",co2State,true,true)
	co2channel.updateValue("CO2_LEVEL",co2,true,true)

	var dew_point = this.dew_point(temp, hum)
	channel.updateValue("DEW_POINT",dew_point,true,true)
	var absolute_humidity = this.absolute_humidity(temp, hum)
	channel.updateValue("ABS_HUMIDITY",absolute_humidity,true,true)
}


module.exports = {
	  NA_Module4 : NA_Module4
}
