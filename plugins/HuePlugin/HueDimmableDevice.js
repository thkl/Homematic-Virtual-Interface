"use strict";

var hueconf = require("node-hue-api");
const EventEmitter = require('events');
const util = require('util');

var HomematicDevice;

var HueDimmableDevice = function(plugin, hueApi ,light,serialprefix) {


		var that = this;
		this.api =  hueApi;
		this.log = plugin.log;
		this.bridge = plugin.server.getBridge();
		this.plugin = plugin;
		
		HomematicDevice = plugin.server.homematicDevice;
		
		this.lightId = light["id"];
		this.isGroup = (light["uniqueid"] == undefined);
		this.transitiontime = 4; // Default Hue
		this.onTime = 0;
		this.lastLevel = 0;

		this.config = plugin.server.configuration;
		this.reportFaults = false;

		if (this.config!=undefined) {
			this.log.debug("Config is valid");
			this.reportFaults = this.config.getValueForPluginWithDefault(this.plugin.name,"reportFaults",false);
		}

		this.log.debug("Setup new HUE Bridged Device %s",serialprefix + this.lightId );
		
		this.reload();
		 
		var serial = light["uniqueid"];

		this.hmDevice = new HomematicDevice(this.plugin.name);

	// try to load persistant object
		if (serial != undefined) {
			this.log.debug("Serial %s",serial);
			var data = this.bridge.deviceDataWithSerial(serial);
			if (data!=undefined) {
				this.hmDevice.initWithStoredData(data);
			}
		} 
		
		if (this.hmDevice.initialized == false) {
	// not found create a new one
			this.log.debug("no Stored Object");
			this.hmDevice.initWithType("HM-LC-Dim1T-Pl", serialprefix  + this.lightId);
			this.hmDevice.firmware = light["swversion"];
			var uniqueid = light["uniqueid"];
	
			if (uniqueid!=undefined) {
				this.hmDevice.serialNumber = uniqueid
			}
			this.bridge.addDevice(this.hmDevice,true);
		} else {
			this.bridge.addDevice(this.hmDevice,false);
		}
		
		

		this.hmDevice.on('device_channel_value_change', function(parameter){
			
			that.log.debug("Value was changed " + JSON.stringify(parameter) );
			var newValue = parameter.newValue;
			
			var channel = that.hmDevice.getChannel(parameter.channel);

			if (parameter.name == "INSTALL_TEST") {
				that.alert();
				channel.endUpdating("INSTALL_TEST");
	      	}


			if (parameter.name == "PROGRAM") {
				switch(newValue) {
					case 0:
						that.effect("none");
					break;
					case 1:
					case 2:
					case 3:
					break;
					case 4:
						that.alert();
					break;
    			}
				channel.endUpdating("PROGRAM");
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
	       if (newValue==true) {
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

	    });

	    /* 
	     this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 1000);
		*/
		
		EventEmitter.call(this);
				
	}
	
	util.inherits(HueDimmableDevice, EventEmitter);
	
	
	
	HueDimmableDevice.prototype.reload = function() {
		if (this.config!=undefined) {
			this.log.debug("Reload Lamp Configuration ...");
			this.refresh = (this.config.getValueForPluginWithDefault(this.plugin.name,"refresh",60))*1000;
			this.log.debug("Refresh Rate is %s ms",this.refresh);
		}
	}
	
	HueDimmableDevice.prototype.alert = function() {
		if (this.isGroup == true) {
		     this.api.setGroupLightState(this.lightId,{"alert":"lselect"}, function(err, result) {});
		} else {
			this.api.setLightState(this.lightId,{"alert":"lselect"}, function(err, result) {});
		}
	}


	HueDimmableDevice.prototype.effect = function(effectname) {
		if (this.isGroup == true) {
		     this.api.setGroupLightState(this.lightId,{"effect":effectname}, function(err, result) {});
		} else {
			this.api.setLightState(this.lightId,{"effect":effectname}, function(err, result) {});
		}
	}


	HueDimmableDevice.prototype.setLevel = function(newLevel) {
	    var that = this;
	    
	    this.emit('direct_light_event', this);
	    
	    var di_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
		di_channel.startUpdating("LEVEL");
		di_channel.updateValue("LEVEL",newLevel);
		var newState = {"transitiontime":that.transitiontime};
	      if (newLevel > 0) {
	        newState["on"] = true;
	        newState["bri"] = (newLevel/1)*255;

	      } else {
	        newState["on"] = false;
	        newState["bri"] = 0;
	    }
		this.log.debug(JSON.stringify(newState));
		
		
		if (that.isGroup == true) {

	    that.api.setGroupLightState(that.lightId,newState, function(err, result) {
	     if (di_channel != undefined) {
	        di_channel.endUpdating("LEVEL");
	      }
	    });

		} else {

		that.api.setLightState(that.lightId,newState, function(err, result) {
	      if (di_channel != undefined) {
	        di_channel.endUpdating("LEVEL");
	      }
	    });
	    }
	}

	HueDimmableDevice.prototype.refreshDevice = function(device) {
	  var that = this;
	  that.log.debug("Refreshing Devices");
	  
	  if (that.isGroup == true) {
	  
	  this.api.getGroup(this.lightId, function(err, result) {
		this.log.debug(JSON.stringify(result));
	    var state = result["lastAction"]["on"];
	    var bri = result["lastAction"]["bri"];

	    var di_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");

	    if (di_channel!=undefined) {
		    if (state==true) {
		        di_channel.updateValue("LEVEL",(bri/254),true);
	    	}
	    }
	  });

	}
	  else {
	

	  this.api.lightStatus(this.lightId, function(err, result) {
	    var state = result["state"]["on"];
	    var bri = result["state"]["bri"];
	  	
		if (that.reportFaults == true) {
			var reachable = result["state"]["reachable"];
			var ch_maintenance = that.hmDevice.getChannelWithTypeAndIndex("MAINTENANCE",0);
			var postToCCU = (ch_maintenance.getValue("UNREACH")==reachable);
			ch_maintenance.updateValue("UNREACH", !reachable,true);
			if (reachable == false) {
				ch_maintenance.updateValue("STICKY_UNREACH", true ,true);
			}
		}
	    
	    var di_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
	  
	    if (di_channel!=undefined) {
		    if (state==true) {
	        	di_channel.updateValue("LEVEL",(bri/254),true);
			}
	    }

	  });
	}

	 this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, that.refresh);
	}


	HueDimmableDevice.prototype.refreshWithData = function (data) {
		var state = data["state"]["on"];
	    var bri = data["state"]["bri"];
	  	
		if (this.reportFaults == true) {
			var reachable = data["state"]["reachable"];
			var ch_maintenance = this.hmDevice.getChannelWithTypeAndIndex("MAINTENANCE",0);
			var postToCCU = (ch_maintenance.getValue("UNREACH")==reachable);
			ch_maintenance.updateValue("UNREACH", !reachable,true);
			if (reachable == false) {
				ch_maintenance.updateValue("STICKY_UNREACH", true ,true);
			}
		}
	    
	    var di_channel = this.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
	  
	    if (di_channel!=undefined) {
		    if (state==true) {
	        	di_channel.updateValue("LEVEL",(bri/254),true);
			}
	    }

	}


	module.exports = {
	  HueDimmableDevice : HueDimmableDevice
	}
