
var HomematicDevice;

var NetAtmoDevice = function(plugin, netAtmoApi ,naDevice,serialprefix) {

	var that = this;
	this.api =  netAtmoApi;
	this.log = plugin.log;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	
	HomematicDevice = plugin.server.homematicDevice;
		
	this.naId = naDevice["_id"];

	var type = naDevice["type"];
	if (type=="NAMain") {
	
		this.log.debug("Initialize NetAtmo Device with id %s",this.naId);

		this.hmInside = new HomematicDevice();
		this.hmInside.initWithType("HM-WDS40-TH-I-2", serialprefix + "1");
		this.hmInside.firmware = naDevice["firmware"];
		this.hmInside.serialNumber = this.naId;
		this.bridge.addDevice(this.hmInside);
		
		this.hmCarbonDioxide = new HomematicDevice();
		this.hmCarbonDioxide.initWithType("HM-CC-SCD", serialprefix + "2");
		this.hmCarbonDioxide.firmware = naDevice["firmware"];
		this.hmCarbonDioxide.serialNumber = this.naId + "_C";
		this.bridge.addDevice(this.hmCarbonDioxide);

		var mi = 3;

		// Add Modules
		
		var modules = naDevice["modules"];
		modules.forEach(function (module) {
			
			var mid = module["_id"];
			if (module["type"] == "NAModule1") {
				hmModule = new HomematicDevice();
				hmModule.initWithType("HM-WDS10-TH-O", serialprefix + mi);
				hmModule.firmware = naDevice["firmware"];
				hmModule.serialNumber = mid;
				that.bridge.addDevice(hmModule);
			}
			
			that.modules[mid] = hmModule;
			mi = mi + 1;
		});

		this.refreshDevice();
	}
	this.name = naDevice["station_name"];
	this.hm_device_name = naDevice["hm_device_name"];
}



NetAtmoDevice.prototype.refreshDevice = function() {
	  var that = this;
      this.log.debug("Refresh NetAtmo Device with id %s",this.naId);
      
	  var options = {device_id: this.naId , date_end :'last', scale: 'max',type: ['Temperature','Humidity','CO2']};

		this.api.getMeasure(options, function(err, measure) {
			if ((measure != undefined) && (measure[0]!=undefined)) {
			var lastMeasure = measure[0]["value"]
			if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 

			var inside_channel = that.hmInside.getChannelWithTypeAndIndex("WEATHER","1");
			
			if (inside_channel != undefined) {
				 inside_channel.updateValue("TEMPERATURE",lastMeasure[0][0],true);
				 inside_channel.updateValue("HUMIDITY",lastMeasure[0][1],true);
			}
			
			var coChannel = that.hmCarbonDioxide.getChannelWithTypeAndIndex("SENSOR_FOR_CARBON_DIOXIDE","1");
			if (coChannel != undefined) {
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
				coChannel.updateValue("STATE",co2State,true);
			}
			}
			}
		});
		
		// Update modules
		
		Object.keys(that.modules).forEach(function (module) {
			  that.log.debug("Loading Moduledata %s",module);
		
			  var options = {device_id: that.naId ,module_id:module, date_end :'last', scale: 'max',type: ['Temperature','Humidity']};
			  
			  that.api.getMeasure(options, function(err, measure) {
					var lastMeasure = measure[0]["value"]
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var hmDevice = that.modules[module];
			  			var channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1");
			  			if (channel != undefined) {
			  				channel.updateValue("TEMPERATURE",lastMeasure[0][0],true);
			  				channel.updateValue("HUMIDITY",lastMeasure[0][1],true);
						}
					}
				});
		});
		
		
		this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 120000);
}


module.exports = {
	  NetAtmoDevice : NetAtmoDevice
}
