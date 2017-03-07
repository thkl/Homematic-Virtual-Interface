'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicSwitchService(homematicDevice,log,hmlayer,name) {
    AlexaHomematicSwitchService.super_.apply(this,arguments);
	this.ccuInterface = "BidCos-RF";
}

util.inherits(AlexaHomematicSwitchService, GenericAlexaHomematicService);

AlexaHomematicSwitchService.prototype.getType = function() {
	return "Licht Aktor";
}

AlexaHomematicSwitchService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}



AlexaHomematicSwitchService.prototype.handleEvent = function(event,callback) {
	
		
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




module.exports = AlexaHomematicSwitchService; 