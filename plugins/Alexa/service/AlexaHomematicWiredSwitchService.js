'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicWiredSwitchService(homematicDevice,log,hmlayer) {
    AlexaHomematicWiredSwitchService.super_.apply(this,arguments);
	this.ccuInterface = "BidCos-Wired";
}

util.inherits(AlexaHomematicWiredSwitchService, GenericAlexaHomematicService);

AlexaHomematicWiredSwitchService.prototype.getType = function() {
	return "Licht Aktor";
}

AlexaHomematicWiredSwitchService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}



AlexaHomematicWiredSwitchService.prototype.handleEvent = function(event,callback) {
	
		
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




module.exports = AlexaHomematicWiredSwitchService; 