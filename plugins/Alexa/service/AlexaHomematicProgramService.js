'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicProgramService(homematicDevice,rpcClient,log,hmlayer) {
    AlexaHomematicProgramService.super_.apply(this,arguments);
}

util.inherits(AlexaHomematicProgramService, GenericAlexaHomematicService);

AlexaHomematicProgramService.prototype.getType = function() {
	return "Program Service";
}

AlexaHomematicProgramService.prototype.getActions = function() {
	return ["turnOn","turnOff"];
}



AlexaHomematicProgramService.prototype.handleEvent = function(event,callback) {
	var that = this;
		
	switch (event.header.name) {

		case "TurnOnRequest" : {
			console.log(this.homematicDevice);
			this.sendRega("var x = dom.GetObject('" +  this.homematicDevice + "');if (x) {x.ProgramExecute();}",function (result) {
				callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
			})
		}
		break;


		case "TurnOffRequest" : {

			callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
}


}




module.exports = AlexaHomematicProgramService; 