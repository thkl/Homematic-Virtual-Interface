var HomematicDevice;
var NetAtmoDevice = require(__dirname + "/NetAtmoDevice.js").NetAtmoDevice;
const url = require("url");
const path = require('path');
const util = require("util");



var NA_Module1 = function(plugin, netAtmoApi ,naDevice,module,serialprefix) {

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
		this.hmModule.initWithType("HM-WDS10-TH-O_NA", serialprefix);
		this.hmModule.firmware = naDevice["firmware"];
		this.bridge.addDevice(this.hmModule,true);
	} else {
		this.bridge.addDevice(this.hmModule,false);
	}
		this.hmModule.na_type = module["type"];
		this.hm_device_name = this.hm_device_name  + " / HM-WDS10-TH-O " + serialprefix; 		
}

util.inherits(NA_Module1, NetAtmoDevice);

NA_Module1.prototype.refreshDevice = function() {
	  var that = this;	
	  this.log.debug("Refresh NetAtmo NA_Module1 with id %s",this.naId);
	  var options = {device_id: this.deviceId ,module_id:this.naId, date_end :'last', scale: 'max',type: ['Temperature','Humidity']};
	  this.api.getMeasure(options, function(err, measure) {
		  if ((measure != undefined) && (measure[0]!=undefined)) {
					var lastMeasure = measure[0]["value"]
					if ((lastMeasure !=undefined ) && (lastMeasure[0]!=undefined)) { 
			  			var channel = that.hmModule.getChannelWithTypeAndIndex("WEATHER","1");
			  			if (channel != undefined) {
		  					that.parseModuleData(lastMeasure[0],channel)
			  				}
						}
					}
					
	});
}

NA_Module1.prototype.parseModuleData = function (measurement,channel) {
	var temp = measurement[0];
	var hum = measurement[1];
	channel.updateValue("TEMPERATURE",temp,true,true);
	channel.updateValue("HUMIDITY",hum,true,true);
	var dew_point = this.dew_point(temp, hum);
	channel.updateValue("DEW_POINT",dew_point,true,true);
	var absolute_humidity = this.absolute_humidity(temp, hum);
	channel.updateValue("ABS_HUMIDITY",absolute_humidity,true,true);
}


module.exports = {
	  NA_Module1 : NA_Module1
}
