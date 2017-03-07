'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHarmonyActivityService(homematicDevice,log,hmlayer,name) {
    AlexaHarmonyActivityService.super_.apply(this,arguments);

}

util.inherits(AlexaHarmonyActivityService, GenericAlexaHomematicService);

AlexaHarmonyActivityService.prototype.getType = function() {
	return "Harmony Scene";
}

AlexaHarmonyActivityService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}


AlexaHarmonyActivityService.prototype.handleEvent = function(event,callback) {
	
	
		
	switch (event.header.name) {

		case "TurnOnRequest" :
		case "TurnOffRequest" :
		{
				var channelAdress = event.payload.appliance.applianceId;
				var channel = this.hm_layer.channelWithAdress(channelAdress);
				if (channel) {
					channel.updateValue("PRESS_SHORT",true,true,true);
					var parameter = channel.getParameterObject("PRESS_SHORT");
					if (parameter) {
						parameter["channel"] = channel.adress;
						channel.emit('channel_value_change', parameter);
					} 
					
					callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
				} else {
					callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
				}
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
}


}




module.exports = AlexaHarmonyActivityService; 