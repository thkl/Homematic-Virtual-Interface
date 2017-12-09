"use strict";

var hueconf = require("node-hue-api");
const EventEmitter = require('events');
const util = require('util');

var HomematicDevice;

var HueTempSensor = function(plugin, hueApi ,sensor,serialprefix) {


		var that = this;
		this.api =  hueApi;
		this.log = plugin.log;
		this.bridge = plugin.server.getBridge();
		this.plugin = plugin;
		
		HomematicDevice = plugin.server.homematicDevice;
		
		this.sensorId = sensor["id"];
		
		this.config = plugin.server.configuration;

		if (this.config!=undefined) {
			this.log.debug("Config is valid");
		}

		this.log.debug("Setup new HUE Bridged Temp Sensor %s",serialprefix + this.lightId );
		this.serial = sensor["uniqueid"];
		this.hmDevice = new HomematicDevice(this.plugin.name);

	// try to load persistant object
		if (this.serial != undefined) {
			this.log.debug("Serial %s",this.serial);
			var data = this.bridge.deviceDataWithSerial(this.serial);
			if (data!=undefined) {
				this.hmDevice.initWithStoredData(data);
			}
		} 
		
		if (this.hmDevice.initialized == false) {
	// not found create a new one
			this.log.debug("no Stored Object");
			this.hmDevice.initWithType("HM-WDS40-TH-I-2", serialprefix  + this.sensorId);
			this.hmDevice.firmware = light["swversion"];
				
			if (this.serial!=undefined) {
				this.hmDevice.serialNumber = this.serial
			}
			this.bridge.addDevice(this.hmDevice,true);
		} else {
			this.bridge.addDevice(this.hmDevice,false);
		}
		
	

		
		EventEmitter.call(this);
				
	}
	
	util.inherits(HueTempSensor, EventEmitter);
	
	
	HueTempSensor.prototype.refreshDevice = function(device) {
	   // Do Nothing will refreshWithData	 
	}

	
	HueTempSensor.prototype.refreshWithData = function (data) {
		var temperature = data["state"]["temperature"];
	    
	    var we_channel = this.hmDevice.getChannelWithTypeAndIndex("WEATHER","1");
	  
	    if (we_channel!=undefined) {
		    	we_channel.updateValue("TEMPERATURE",(temperature/100),true);
			}
	}


	module.exports = {
	  HueTempSensor : HueTempSensor
	}
