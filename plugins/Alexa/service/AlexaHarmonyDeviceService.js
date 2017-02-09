'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHarmonyDeviceService(homematicDevice,log,hmlayer) {
    AlexaHarmonyDeviceService.super_.apply(this,arguments);
}

util.inherits(AlexaHarmonyDeviceService, GenericAlexaHomematicService);

AlexaHarmonyDeviceService.prototype.getType = function() {
	return "Harmony Device";
}

AlexaHarmonyDeviceService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}


AlexaHarmonyDeviceService.prototype.handleEvent = function(event,callback) {
	
	
		
	switch (event.header.name) {
		case "TurnOnRequest" :
		case "TurnOffRequest" :
		{
				var command = event.payload.appliance.applianceId;
				if (this.server) {
					
					var cmds = command.split(":");
					if (cmds.length==4) {
					   var pluginName = cmds[0];
					   var splugin = this.server.pluginWithName(pluginName);
					   if (splugin!=undefined) {
							splugin.platform.sendClientAction(command);
							callback("Alexa.ConnectedHome.Control",(event.header.name=="TurnOnRequest") ? "TurnOnConfirmation" : "TurnOffConfirmation");
							return;
						} 
					}
				}
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
}
}



module.exports = AlexaHarmonyDeviceService; 