'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHueSceneService(homematicDevice,rpcClient,log,hmlayer) {
    AlexaHueSceneService.super_.apply(this,arguments);
}

util.inherits(AlexaHueSceneService, GenericAlexaHomematicService);



AlexaHueSceneService.prototype.getType = function() {
	return "Hue Scene";
}


AlexaHueSceneService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}



AlexaHueSceneService.prototype.handleEvent = function(event,callback) {
	
	var that = this;
	switch (event.header.name) {
		case "TurnOnRequest" :
		case "TurnOffRequest" :
		{
			var command = event.payload.appliance.applianceId;
				if (this.server) {
					
					var cmds = command.split(":");
					if (cmds.length==2) {
					   var pluginName = cmds[0];
					   var sceneID = cmds[1];
					   var splugin = this.server.pluginWithName(pluginName);
					   if (splugin!=undefined) {
							splugin.platform.runScene(sceneID);
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


module.exports = AlexaHueSceneService; 