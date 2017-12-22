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
		
		this.sensorId = sensor["id"]
		this.sensorUniqueId = sensor["uniqueid"]
		this.config = plugin.server.configuration;

		if (this.config!=undefined) {
			this.log.debug("Config is valid");
		}
		this.hmName = serialprefix + this.sensorId 
		this.log.info("Setup new HUE Bridged Temp Sensor %s",this.hmName);
		this.serial = this.hmName
		this.hmDevice = new HomematicDevice(this.plugin.name);

	// try to load persistant object
		if (this.serial != undefined) {
			this.log.debug("Serial %s",this.serial);
			var data = this.bridge.deviceDataWithSerial(this.hmName);
			if (data!=undefined) {
				this.hmDevice.initWithStoredData(data);
			}
		} 
		
		if (this.hmDevice.initialized == false) {
	// not found create a new one
			this.log.debug("no Stored Object");
			this.hmDevice.initWithType("HM-WDS40-TH-I-2", serialprefix  + this.sensorId);
			this.hmDevice.firmware = sensor["swversion"];
				
		    this.log.debug("Serial %s",this.serial)
			if (this.serial!=undefined) {
				this.hmDevice.serialNumber = this.hmName
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
	    if (!temperature) { 
		    temperature = 0
		    this.log.info("Temp Missing %s",JSON.stringify(data))    
		}
	    var we_channel = this.hmDevice.getChannelWithTypeAndIndex("WEATHER","1");
	  
	    if (we_channel!=undefined) {
		    	we_channel.updateValue("TEMPERATURE",(temperature/100),true);
		}
	}


	module.exports = {
	  HueTempSensor : HueTempSensor
	}
