'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaLogicService(homematicDevice,rpcClient) {
    AlexaLogicService.super_.apply(this,arguments);
}

util.inherits(AlexaLogicService, GenericAlexaHomematicService);

AlexaLogicService.prototype.getType = function() {
	return "Logic Function";
}


AlexaLogicService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}


AlexaLogicService.prototype.handleEvent = function(event,callback) {
	var that = this;

	switch (event.header.name) {

		case "TurnOnRequest" : {
			
			var sw_channel = this.virtual_device.getChannelWithTypeAndIndex("SWITCH","1");
			sw_channel.updateValue("STATE",true,true,true);
			callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
		}
		break;


		case "TurnOffRequest" : {
			var sw_channel = this.virtual_device.getChannelWithTypeAndIndex("SWITCH","1");
			sw_channel.updateValue("STATE",false,true,true);
			callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
	}
		
}



module.exports = AlexaLogicService; 