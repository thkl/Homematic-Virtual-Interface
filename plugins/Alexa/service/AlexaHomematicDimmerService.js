'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicDimmerService(homematicDevice,rpcClient) {
    AlexaHomematicDimmerService.super_.apply(this,arguments);
}

util.inherits(AlexaHomematicDimmerService, GenericAlexaHomematicService);



AlexaHomematicDimmerService.prototype.getType = function() {
	return "Dimmer";
}


AlexaHomematicDimmerService.prototype.getActions = function() {
	return ["turnOn","turnOff","setPercentage","incrementPercentage","decrementPercentage"];
}



AlexaHomematicDimmerService.prototype.handleEvent = function(event,callback) {
	
	
	console.log("Event %s",JSON.stringify(event));
	var that = this;

	switch (event.header.name) {

		case "TurnOnRequest" : {
			this.setState(this.homematicDevice,"LEVEL",{"explicitDouble":1});
			callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
		}
		break;


		case "TurnOffRequest" : {
			this.setState(this.homematicDevice,"LEVEL",{"explicitDouble":0});
			callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
		}
		break;
		
		case "SetPercentageRequest": {
			var newValue = event.payload.percentageState.value;
			this.setState(this.homematicDevice,"LEVEL",{"explicitDouble":newValue/100});
			callback("Alexa.ConnectedHome.Control","SetPercentageConfirmation");
		}
		break;

		case "IncrementPercentageRequest": {
			var newValue = event.payload.deltaPercentage.value;
			this.getState(this.homematicDevice,"LEVEL",function (error,level){
				var newLevel = (level * 100) + newValue;
				that.setState(that.homematicDevice,"LEVEL",{"explicitDouble":newLevel/100});
				callback("Alexa.ConnectedHome.Control","IncrementPercentageConfirmation");
				
			});
		}
		break;
		
		case "DecrementPercentageRequest": {
			var newValue = event.payload.deltaPercentage.value;
			this.getState(this.homematicDevice,"LEVEL",function (error,level){
				var newLevel = (level * 100) - newValue;
				that.setState(that.homematicDevice,"LEVEL",{"explicitDouble":newLevel/100});
				callback("Alexa.ConnectedHome.Control","DecrementPercentageConfirmation");
			});
		}
		break;
		
		
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
		
}


}

module.exports = AlexaHomematicDimmerService; 