var HomematicDevice;
var NetAtmoDevice = require(__dirname + "/NetAtmoDevice.js").NetAtmoDevice;
const url = require("url");
const path = require('path');
const util = require("util");



var NA_Main = function(plugin, netAtmoApi ,naDevice,serialprefix) {

	var that = this;
	this.api =  netAtmoApi;
	this.log = plugin.log;
	this.plugin = plugin;
	this.name = plugin.name;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	this.naId = naDevice["_id"];
	var HomematicDevice = plugin.server.homematicDevice;
	this.log.debug("Initialize NetAtmo Main Device with id %s",this.naId);
	this.hmInside = new HomematicDevice(this.plugin.getName());
	var data = this.bridge.deviceDataWithSerial(this.naId);
	if (data!=undefined) {
		this.hmInside.initWithStoredData(data);
	}

	if (this.hmInside.initialized === false) {
		this.hmInside.initWithType("HM-WDS40-TH-I-2_NA", serialprefix + "1");
		this.hmInside.firmware = naDevice["firmware"];
		this.hmInside.serialNumber = this.naId;
		this.bridge.addDevice(this.hmInside,true);
	} else {
		this.bridge.addDevice(this.hmInside,false);
	}
		
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
	this.hm_device_name = "HM-WDS40-TH-I-2 "+ serialprefix + "1 / HM-CC-SCD " + serialprefix + "2";
}

util.inherits(NA_Main, NetAtmoDevice);


NA_Main.prototype.refreshDevice = function() {
	  var that = this;	
      this.log.info("Refresh NetAtmo Main Device with id %s",this.naId);
      
	  var options = {device_id: this.naId , date_end :'last', scale: 'max',type: ['Temperature','Humidity','CO2','Pressure','Noise']};

		this.api.getMeasure(options, function(err, measure) {
			if ((measure != undefined) && (measure[0]!=undefined)) {
			var lastMeasure = measure[0]["value"]
			if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 

			var inside_channel = that.hmInside.getChannelWithTypeAndIndex("WEATHER","1");
			
			if (inside_channel != undefined) {
				var temp = lastMeasure[0][0];
				var hum = lastMeasure[0][1];
				var pressure = lastMeasure[0][3];
				var noise = lastMeasure[0][4];
				
				inside_channel.updateValue("TEMPERATURE",temp,true,true);
				inside_channel.updateValue("HUMIDITY",hum,true,true);
				var dew_point = that.dew_point(temp, hum);
			  	inside_channel.updateValue("DEW_POINT",dew_point,true,true);
			  	var absolute_humidity = that.absolute_humidity(temp, hum);
			  	inside_channel.updateValue("ABS_HUMIDITY",absolute_humidity,true,true);
			  	inside_channel.updateValue("AIR_PRESSURE",pressure,true,true);
			  	inside_channel.updateValue("NOISE",noise,true,true);
			}
			
			var coChannel = that.hmCarbonDioxide.getChannelWithTypeAndIndex("SENSOR_FOR_CARBON_DIOXIDE","1");
			if (coChannel != undefined) {
				that.log.debug("Set CO2 Level from Measurement %s",JSON.stringify(lastMeasure[0]));
				var co2 = lastMeasure[0][2];
				var co2State = 0;
				
				var lvlAdded = that.configuration.getPersistValueForPluginWithDefault(that.name,"CO2_ADDED",1000);
				var lvlStrong = that.configuration.getPersistValueForPluginWithDefault(that.name,"CO2_ADDED_STRONG",1400);
				var co2_var = that.configuration.getValueForPlugin(that.name,'co2_var')
				that.log.debug('CO2 Var is %s',co2_var)
				if (co2 > lvlAdded) {
					 co2State = 1;
				}
				if (co2 > lvlStrong) {
					co2State = 2;
				}
				coChannel.updateValue("STATE",co2State,true,true);
				coChannel.updateValue("CO2_LEVEL",co2,true,true);
				
				// Add CO2 to Variable
				if (co2_var !== undefined) {
					let script = 'var oV = dom.GetObject(ID_SYSTEM_VARIABLES).Get("' + co2_var + '");if (oV) {oV.State(' + co2 + ');}'
					that.log.info('Run CO2 Update %s',script)
					that.bridge.runRegaScript(script,function(result){
						
					})
				}
			} else {
				that.log.warn("CO2 Channel not found");
			}
			}
			}
		});
}

module.exports = {
	  NA_Main : NA_Main
}
