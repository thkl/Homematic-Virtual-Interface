
var HomematicDevice;

var NetAtmoDevice = function(plugin, netAtmoApi ,naDevice,serialprefix) {

	var that = this;
	this.api =  netAtmoApi;
	this.log = plugin.log;
	this.plugin = plugin;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	
	HomematicDevice = plugin.server.homematicDevice;
		
	this.naId = naDevice["_id"];

	var type = naDevice["type"];
	if (type=="NAMain") {
	
		this.log.debug("Initialize NetAtmo Device with id %s",this.naId);


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

		var mi = 3;

		// Add Modules
		
		var modules = naDevice["modules"];
		modules.forEach(function (module) {
			
			var mid = module["_id"];
			if (module["type"] === "NAModule1") {
				var hmModule = new HomematicDevice(that.plugin.getName());
				var data = that.bridge.deviceDataWithSerial(mid);
				if (data != undefined) {
					hmModule.initWithStoredData(data);
				}
				
				if (hmModule.initialized === false) {
					hmModule.initWithType("HM-WDS10-TH-O_NA", serialprefix + mi);
					hmModule.firmware = naDevice["firmware"];
					hmModule.serialNumber = mid;
					that.bridge.addDevice(hmModule,true);
				} else {
					that.bridge.addDevice(hmModule,false);
				}
				hmModule.na_type = module["type"];
				that.modules[mid] = hmModule;
				that.hm_device_name = that.hm_device_name  + " / HM-WDS10-TH-O " + serialprefix + mi; 
			}
/*
			if (module["type"] === "NAModule4") {
				var hmModule = new HomematicDevice(that.plugin.getName());
				var data = that.bridge.deviceDataWithSerial(mid);
				if (data != undefined) {
					hmModule.initWithStoredData(data);
				}
				
				if (hmModule.initialized === false) {
					hmModule.initWithType("HM-WDS40-TH-I-2_NA", serialprefix + mi);
					hmModule.firmware = naDevice["firmware"];
					hmModule.serialNumber = mid;
					that.bridge.addDevice(hmModule,true);
				} else {
					that.bridge.addDevice(hmModule,false);
				}
				that.modules[mid] = hmModule;
				that.hm_device_name = that.hm_device_name  + " / HM-WDS40-TH-I-2_NA" + serialprefix + mi; 
			}
*/
			
			mi = mi + 1;
		});

		this.refreshDevice();
	}
	this.name = naDevice["station_name"];
}



NetAtmoDevice.prototype.refreshDevice = function() {
	  var that = this;	
      this.log.debug("Refresh NetAtmo Device with id %s",this.naId);
      
	  var options = {device_id: this.naId , date_end :'last', scale: 'max',type: ['Temperature','Humidity','CO2','Pressure','Noise']};

		this.api.getMeasure(options, function(err, measure) {
			if ((measure != undefined) && (measure[0]!=undefined)) {
				that.log.debug("NetAtmo Measurement %s",JSON.stringify(measure));
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
				that.log.debug("Set CO2 Level from Measuremet %s",JSON.stringify(lastMeasure[0]));
				var co2 = lastMeasure[0][2];
				var co2State = 0;
				
				var lvlAdded = that.configuration.getPersistValueForPluginWithDefault(that.name,"CO2_ADDED",1000);
				var lvlStrong = that.configuration.getPersistValueForPluginWithDefault(that.name,"CO2_ADDED_STRONG",1400);
				
				if (co2 > lvlAdded) {
					 co2State = 1;
				}
				if (co2 > lvlStrong) {
					co2State = 2;
				}
				coChannel.updateValue("STATE",co2State,true,true);
				coChannel.updateValue("CO2_LEVEL",co2,true,true);
			} else {
				that.log.warn("CO2 Channel not found");
			}
			}
			}
		});
		
		// Update modules
		
		Object.keys(that.modules).forEach(function (module) {
			
			  var mo = that.modules[module];
			  var mo_type = mo.na_type;
			  that.log.debug("Loading Moduledata %s",mo_type);
			  var measure_type = [];
			  
			  switch (mo_type) {
				  case "NAModule1" :
				   measure_type = ['Temperature','Humidity'];
				   break;

				  case "NAModule4" :
				   measure_type = ['Temperature','Humidity','CO2'];
				   break;
				   
			  }
			  
			  
			  var options = {device_id: that.naId ,module_id:module, date_end :'last', scale: 'max',type: measure_type};
			  
			  that.api.getMeasure(options, function(err, measure) {
				  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]["value"]
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var hmDevice = that.modules[module];
			  			var channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1");
			  			if (channel != undefined) {
				  			switch (mo_type) {
				  				case "NAModule1" :
				  					that.parseNA1ModuleData(lastMeasure[0],channel)
				  					break;
				  				case "NAModule4" :
				  					that.parseNA4ModuleData(lastMeasure[0],channel)
				  					break;
				   
			  				}
						}
					}
					}
				});
		});
		
		// Update Station Data to search for LowBat
		this.api.getStationsData(function(err, devices) {
			// search for modules
			try {
			devices.some(function (device){
				device.modules.some(function (module){
					if (module.battery_percent) {
					var bat = module.battery_percent;
						Object.keys(that.modules).forEach(function (s_modId) {
						if (s_modId===module["_id"]) {
							var hmDevice = that.modules[s_modId];
							if (hmDevice) {
								var channel = hmDevice.getChannelWithTypeAndIndex("MAINTENANCE","0");
								if (channel) {
									// forcing that
									channel.updateValue("LOWBAT", (bat < 20) ,true,true);
								}
							}
						}
						});
					}
				});
			});
			} catch (e) {
				that.log.error("NetAtmo getStationError %s",e);
			}
		});
		
		
		var refreshrate = this.configuration.getPersistValueForPluginWithDefault(this.plugin.name,"refresh",360)*1000;
		if (refreshrate < 120000) {
			refreshrate = 120000
		}
		
		this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		}, refreshrate);
}


NetAtmoDevice.prototype.parseNA1ModuleData = function (measurement,channel) {
	var temp = measurement[0];
	var hum = measurement[1];
	channel.updateValue("TEMPERATURE",temp,true,true);
	channel.updateValue("HUMIDITY",hum,true,true);
	var dew_point = that.dew_point(temp, hum);
	channel.updateValue("DEW_POINT",dew_point,true,true);
	var absolute_humidity = that.absolute_humidity(temp, hum);
	channel.updateValue("ABS_HUMIDITY",absolute_humidity,true,true);
}

NetAtmoDevice.prototype.parseNA4ModuleData = function (measurement,channel) {
	var temp = measurement[0];
	var hum = measurement[1];
	var co2 = measurement[3];
	channel.updateValue("TEMPERATURE",temp,true,true);
	channel.updateValue("HUMIDITY",hum,true,true);
	var dew_point = that.dew_point(temp, hum);
	channel.updateValue("DEW_POINT",dew_point,true,true);
	var absolute_humidity = that.absolute_humidity(temp, hum);
	channel.updateValue("ABS_HUMIDITY",absolute_humidity,true,true);
	
}




// calculations from https://www.wetterochs.de/wetter/feuchte.html
NetAtmoDevice.prototype.saturation_vapor_pressure =  function(temperature)
{
	var a, b;
	if(temperature >= 0)
	{
		a = 7.5;
		b = 237.3;
	}
	else
	{
		a = 7.6;
		b = 240.7;
	}

	var saturation_vapor_pressure = 6.1078 * Math.exp(((a*temperature)/(b+temperature))/Math.LOG10E);

	return saturation_vapor_pressure;
}

NetAtmoDevice.prototype.vapor_pressure =   function (temperature, relative_humidity)
{
	var saturation_vapor_pressure = this.saturation_vapor_pressure(temperature);
	var vapor_pressure = relative_humidity/100 * saturation_vapor_pressure;
	return vapor_pressure;
}


NetAtmoDevice.prototype.dew_point =  function (temperature, relative_humidity)
{
	var vapor_pressure = this.vapor_pressure(temperature, relative_humidity);
	var a, b;

	if(temperature >= 0)
	{
		a = 7.5;
		b = 237.3;
	}
	else
	{
		a = 7.6;
		b = 240.7;
	}
	var c = Math.log(vapor_pressure/6.1078) * Math.LOG10E;
	var dew_point = (b * c) / (a - c);
	return dew_point;
}

NetAtmoDevice.prototype.absolute_humidity = function (temperature, relative_humidity) {
	var mw = 18.016;
	var r_star = 8314.3;
	var vapor_pressure = 100 * this.vapor_pressure(temperature, relative_humidity);
	var absolute_humidity = 1000 * mw/r_star * vapor_pressure/this.CelsiusToKelvin(temperature);
	return absolute_humidity;
}

NetAtmoDevice.prototype.CelsiusToKelvin = function (temperature)
{
	return temperature + 273.15;
}

module.exports = {
	  NetAtmoDevice : NetAtmoDevice
}
