'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicHMIPSwitchService(homematicDevice,log,hmlayer) {
    AlexaHomematicHMIPSwitchService.super_.apply(this,arguments);
	this.ccuInterface = "HmIP-RF";
}

util.inherits(AlexaHomematicHMIPSwitchService, GenericAlexaHomematicService);

AlexaHomematicHMIPSwitchService.prototype.getType = function() {
	return "Licht Aktor";
}

AlexaHomematicHMIPSwitchService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}



AlexaHomematicHMIPSwitchService.prototype.handleEvent = function(event,callback) {
	
		
	switch (event.header.name) {

		case "TurnOnRequest" : {
			this.setState(this.homematicDevice,"STATE",true);
			callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
		}
		break;


		case "TurnOffRequest" : {
			this.setState(this.homematicDevice,"STATE",false);
			callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
}


}




module.exports = AlexaHomematicHMIPSwitchService; 