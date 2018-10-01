	"use strict";

var HomematicDevice;

var LightifyWhiteDevice = function(plugin, api ,light,serialprefix) {


		var that = this;
		this.api =  api;
		this.log = plugin.log;
		this.bridge = plugin.server.getBridge();
		this.plugin = plugin;
		
		HomematicDevice = plugin.server.homematicDevice;
		
		this.mac = light["mac"];
		this.onTime = 0;
		this.lastLevel = 0;

		this.log.debug("Setup new Lightify White Device %s",serialprefix);
		this.transitiontime = 4;

		this.hmDevice = new HomematicDevice(this.plugin.getName());
		// TODO Stored Devices
		this.hmDevice.initWithType("VIR-LG-WHITE-DIM", serialprefix);
		this.hmDevice.firmware = light["firmware_version"];
		this.bridge.addDevice(this.hmDevice);

		this.hmDevice.on('device_channel_value_change', function(parameter){
			
			that.log.debug("Value was changed " + JSON.stringify(parameter) );
			var newValue = parameter.newValue;
			
			var channel = that.hmDevice.getChannel(parameter.channel);

			if (parameter.name == "INSTALL_TEST") {
				
				channel.endUpdating("INSTALL_TEST");
	      	}


	      if (parameter.name == "LEVEL") {
	       that.setLevel(newValue);
		   if ((that.onTime > 0) && (newValue>0)) {
		    setTimeout(function() {that.setLevel(0);}, that.onTime * 1000);
	       }
	       // reset the transition and on time 
	       that.transitiontime = 4;
	       that.onTime = 0;
	       if (newValue > 0) {
		       that.lastLevel = newValue;
	       }
	     }


		 if (parameter.name == "OLD_LEVEL") {
	       if (newValue==true) {
		      if (that.lastLevel == 0) {
			      that.lastLevel = 1;
		      }
		      that.setLevel(that.lastLevel); 
	       
	       }
	       
	     }

	    if ((parameter.name == "RAMP_TIME") && (channel.index == "1")) {
		  that.transitiontime = newValue*10;
		}

	    if ((parameter.name == "ON_TIME") && (channel.index == "1")) {
		  that.onTime = newValue;
		}

		if (parameter.name == "WHITE") {
		  that.setWhite(newValue);
	     }




	    });

	     this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 1000);

	}
	
	
	LightifyWhiteDevice.prototype.setWhite = function(newTemp) {
	    var co_channel = this.hmDevice.getChannelWithTypeAndIndex("VIR-LG_WHITE-DIM-CH","1");
		if (co_channel != undefined) {
			this.api.nodeTemperature(this.mac,newTemp,this.transitiontime);
			co_channel.updateValue("WHITE",newTemp);
		}
	}


	LightifyWhiteDevice.prototype.setLevel = function(newLevel) {
	    var di_channel = this.hmDevice.getChannelWithTypeAndIndex("VIR-LG_WHITE-DIM-CH","1");
		if (di_channel != undefined) {
			di_channel.startUpdating("LEVEL");
			di_channel.updateValue("LEVEL",newLevel);
			this.api.nodeBrightness(this.mac,newLevel*100, this.transitiontime);
			di_channel.endUpdating("LEVEL");
		}
	}

	LightifyWhiteDevice.prototype.refreshDevice = function(device) {
	  var that = this;
	  
	  this.api.getStatus(this.mac).then(function(data) {
		  that.log.debug(data);
		  if ((data != undefined) && (data.result != undefined)) {
		  	  var di_channel = that.hmDevice.getChannelWithTypeAndIndex("VIR-LG_WHITE-DIM-CH","1");
		  	  that.log.debug("Query Reslut %s",JSON.stringify(data["result"][0]["brightness"]));
			  var bri = data["result"][0]["brightness"] / 100;
			  that.log.debug("Set Osram Level to %s",bri);
			  di_channel.updateValue("LEVEL",bri,true);
			  var temperature = data["result"][0]["temperature"];
			  di_channel.updateValue("WHITE",temperature,true);
			  
			  }			 
	  });
	

	 this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
	 }, 60000);
	}



	module.exports = {
	  LightifyWhiteDevice : LightifyWhiteDevice
	}
