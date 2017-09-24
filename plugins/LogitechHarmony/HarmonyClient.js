
//
//  HarmonyClient.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var harmony = require('hvl_harmonyhubjs-client');
var HomematicDevice;
const util = require('util');

var HarmonyClient = function (plugin) {
	this.name = plugin.name;
	this.plugin = plugin;
	this.log = this.plugin.log;
	this.server = this.plugin.server;
	this.config = this.server.configuration;
	this.bridge = this.server.getBridge();
	this.activities = [];
	this.hubIP = this.config.getValueForPluginWithDefault(this.name,"hub_ip",undefined);
	this.intervall = this.config.getValueForPluginWithDefault(this.name,"intervall",60000);
	this.harmonyDevices = [];
	this.init();
}

HarmonyClient.prototype.init = function() {
  var that = this;
  HomematicDevice = this.server.homematicDevice;
  this.hmDevice = new HomematicDevice(this.name);
  var serial = "HarmonyAct";
  var data = this.bridge.deviceDataWithSerial(serial);
  if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
  }

  if (this.hmDevice.initialized == false) {
  	this.hmDevice.initWithType("HM-RC-19_Harmony", serial);
  	this.bridge.addDevice(this.hmDevice);
  }
  
  else {
	this.bridge.addDevice(this.hmDevice,false);
  }
  
  var adx = 1;  
  that.log.info("Start talking to your harmony")
  harmony(this.hubIP).then(function(harmonyClient) {
	  that.log.info("fetching activities")
	  harmonyClient.getActivities().then(function(activities) {
		activities.forEach(function (activity){
			var ac = {"id":activity.id,"label":activity.label,"adress":adx};
			var ch = that.getChannelForActivity(activity.id)
			if (ch) {
				that.log.debug("Channel found : %s with Index %s",ch,ch.index);
				ac["chid"] = ch.index;
			} else {
				var chnext = that.getNextFreeChannelForActivity();
				if (chnext) {
					chnext.setParamsetValue("MASTER","CMD_PRESS_SHORT",activity.id);
					chnext.setParamsetValue("MASTER","CMD_PRESS_LONG",activity.label);
					ac["chid"] = chnext.index;
				} else {
					that.log.warn("Can not found any free channel on remote. thats bad");
				}
			}
			that.activities.push(ac);
			adx = adx + 1;
		});
		//that.log.debug("Activities : %",JSON.stringify(that.activities));
	  }).finally(function () {
   	    that.log.debug("Closing");
        harmonyClient.end()
        that.bridge.saveDevice(that.hmDevice);
        
        // Clean
        that.log.debug("Cleaning");
        that.cleanUp();
        
  }).catch(function (e) {
    that.log.error(e.stack);
  });
  });
  
  harmony(this.hubIP).then(function(harmonyClient) {
  	return harmonyClient.getAvailableCommands()
      .then(function (commands) {
	     that.log.debug("Setup Harmony Devices");
		 that.harmonyDevices = commands.device;
  	})
  	.finally(function () {
        harmonyClient.end();
  }).catch(function (e) {
     that.log.error(e.stack);
  })
  });

  this.hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = that.hmDevice.getChannel(parameter.channel);
		if (parameter.name == "PRESS_SHORT") {
					
			var acID = channel.getParamsetValueWithDefault("MASTER","CMD_PRESS_SHORT","");		
			/*		
			var selectedActivity = that.activities
                .filter(function (activity) { return activity.adress == channel.index}).pop()
			if (selectedActivity != undefined) {
				*/
				
			if (acID) {
			  that.startActivity(acID);
			} else {
				that.log.debug("No Activity With ID %s found",acID);
			}
	    }
	    
	    if (parameter.name == "COMMAND") {
		    that.log.debug("Harmony Command %s",parameter.newValue);
		    that.sendAction(parameter.newValue);
		}
	});
	
 this.getCurrentActivity();
}

HarmonyClient.prototype.sendAction = function(actionName) {
	var that = this;
	var cmds = actionName.split(".");
	if (cmds.length==3) {
		var deviceName = cmds[0];
		var actionGroup = cmds[1];
		var actionName = cmds[2];
		var device = that.getHarmonyDeviceWithLabel(deviceName);
		if ((device) && (actionGroup) && (actionName)) {
			that.log.debug("Device found trying to find command %s %s",actionGroup,actionName);
			that.do_sendAction(device,actionGroup,actionName);
		} else {
			that.log.error("Device %s ActionGroup %s or Action %s not found",deviceName,actionGroup,actionName);
		}
	}
}


HarmonyClient.prototype.getHarmonyDeviceWithLabel = function(label) {
	return this.harmonyDevices.filter(function (device) { return device.label == label}).pop();
}

HarmonyClient.prototype.getHarmonyAction = function(commands,group,name) {
	var o_group =  commands.filter(function (action_group) { return action_group.name == group}).pop();
	this.log.debug(o_group.function);
	if (o_group.function) {
		return o_group.function.filter(function (action) { return action.name == name}).pop();
	} else {
		return undefined;
	}
}

HarmonyClient.prototype.listActions = function() {
  var result = [];
  this.harmonyDevices.some(function (device){
	  device.controlGroup.some(function (action_group){
		  action_group["function"].some(function (action) {
		  	result.push(device.label + "." + action_group.name + "." + action.name); 
		  });
	  });
  });
  return result;
}

HarmonyClient.prototype.myDevices = function() {
	// return my Devices here
	var result = [];
	var that = this;

	result.push({"id":"sep-ha","name":"--------- Harmony Activities ---------","type":"seperator"});

	this.hmDevice.channels.forEach(function(channel){
		
		var name = channel.getParamsetValue("MASTER","CMD_PRESS_LONG");
		if ((name!=undefined) && (name.length>0)) {
			result.push({"id":channel.adress,"name":name,"type":"HARMONY"});
		}		
	});

	result.push({"id":"sep-hd","name":"--------- Harmony Devices ---------","type":"seperator"});
	this.harmonyDevices.some(function (device){
	  device.controlGroup.some(function (action_group){
		  action_group["function"].some(function (action) {
			var ac = JSON.parse(action.action);
			var encodedAction = that.name+":" + ac["type"]+":"+ac["deviceId"] +":"+ac["command"];
			result.push({"id":encodedAction,"name":device.label + "." + action_group.name + "." + action.name,"device":"","type":"HARMONYDEVICE"}); 
		  });
	  });
  	});

	return result;	
}


HarmonyClient.prototype.do_sendAction = function(device,actionGroup,actionName) {
	var that = this;
	var action = this.getHarmonyAction(device.controlGroup,actionGroup,actionName);
	if (action) {
		that.log.debug("Device and Action are valid send them to the hub");
		harmony(this.hubIP).then(function(harmonyClient) {
			
			
			that.log.debug("Login perfomed go ahead with %s",action.action);
			var encodedAction = action.action.replace(/\:/g, '::');
			that.log.debug("Send Action %s",encodedAction);
			return harmonyClient.send('holdAction', 'action=' + encodedAction + ':status=press')
		
		.finally(function () {
        	harmonyClient.end();
			}).catch(function (e) {
				that.log.error(e.stack);
  			})
  		});
	} else {
		var actions = "";
		device.controlGroup.forEach(function (action){
			actions = actions + action.name + ", ";
		});
		that.log.debug("Action %s not found available actions are %s",actionName,actions);
	}
}

HarmonyClient.prototype.do_sendRawAction = function(rawAction) {
	var that = this;
	var cmds = rawAction.split(":");
	if (cmds.length==4) {
   			// Action is plugin:type:deviceid:command
			// will transformed into {"command"::"OK","type"::"IRCommand","deviceId"::"40208180"}
		var encodedAction = util.format('{"command"::"%s","type"::"%s","deviceId"::"%s"}', cmds[3],cmds[1],cmds[2]);

		harmony(this.hubIP).then(function(harmonyClient) {
			that.log.debug("Send Action %s",encodedAction);
			return harmonyClient.send('holdAction', 'action=' + encodedAction + ':status=press')
		.finally(function () {
        	harmonyClient.end();
			}).catch(function (e) {
				that.log.error(e.stack);
  			})
  		});
	}
}



HarmonyClient.prototype.getChannelForActivity = function(acId) {
	return this.hmDevice.channels.filter(function (channel) { 
		var cmd = channel.getParamsetValueWithDefault("MASTER","CMD_PRESS_SHORT","");
		return cmd == acId;		
	}).pop();
}

HarmonyClient.prototype.getNextFreeChannelForActivity = function() {
	var that = this;
	var result = undefined;
	this.hmDevice.channels.some(function (channel) { 
		if ((channel.index != "0")  && (result == undefined)) {
			var cmd = channel.getParamsetValueWithDefault("MASTER","CMD_PRESS_SHORT","");
			if ((cmd !=undefined) && ( cmd.length==0 )) {
				that.log.info("next free found",channel.index);
				result = channel;
			}
		}
	});
	return result;
}

HarmonyClient.prototype.cleanUp = function() {
	var that = this;
	this.hmDevice.channels.some(function (channel) { 
		if (channel.index != "0") {
			var cmd = channel.getParamsetValueWithDefault("MASTER","CMD_PRESS_SHORT","");
			if ((cmd !=undefined) && ( cmd.length > 0 )) {
				// Check if we are still have this activity id
				if (that.activityWithId(cmd)==undefined) {
					channel.setParamsetValue("MASTER","CMD_PRESS_SHORT","");
					channel.setParamsetValue("MASTER","CMD_PRESS_LONG","");
				}
			}
		}
	});
}


HarmonyClient.prototype.activityWithId = function(a_id) {
	return this.activities.filter(function (activity) { return activity.id == a_id}).pop();
}


HarmonyClient.prototype.getCurrentActivity = function() {
 var that = this;
 try {
	 
 harmony(this.hubIP).then(function(harmonyClient) {
	  harmonyClient.getCurrentActivity().then(function(c_activity) {
	  	
	  	that.log.debug("Responze %s",c_activity);

	  	var selectedActivity = that.activities.filter(function (activity) { return activity.id == c_activity}).pop();
	  	var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
	  	if (selectedActivity) {
		  	channel.updateValue("CURRENT_ACTIVITY",selectedActivity.label,true);
	  	} else {
		  	channel.updateValue("CURRENT_ACTIVITY","Unknow Activity",true);
	  	}
	  	harmonyClient.end();
   });
   
   harmonyClient.on("error",function(error){
	   that.log.error("Harmony Client Exception %s",error);
   });
   
   harmony.on("error",function(error){
	   that.log.error("Harmony Client Exception %s",error);
   });
 });
 

 } catch (ex) {
	 that.log.error(ex);
 }
 
  setTimeout(function () {
	 that.getCurrentActivity();
 }, this.intervall);	
}

HarmonyClient.prototype.getActivities = function() {
  return this.activities;
}

HarmonyClient.prototype.startActivity = function(acId) {
  this.log.debug("Run Activity With ID %s",acId);
  var that = this;
  harmony(this.hubIP).then(function(harmonyClient) {
	  harmonyClient.startActivity(acId);
	  that.log.debug("Closing");
	  harmonyClient.end();
	  that.log.debug("Closed");
  }).catch(function (e) {
    that.log.error(e);
  })	
}


module.exports = {
  HarmonyClient : HarmonyClient
}