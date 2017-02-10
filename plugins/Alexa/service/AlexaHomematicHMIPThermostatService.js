'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicHMIPThermostatService(homematicDevice,log,hmlayer) {
    AlexaHomematicHMIPThermostatService.super_.apply(this,arguments);
	this.ccuInterface = "HmIP-RF";
}

util.inherits(AlexaHomematicHMIPThermostatService, GenericAlexaHomematicService);

AlexaHomematicHMIPThermostatService.prototype.getType = function() {
	return "Thermostat";
}


AlexaHomematicHMIPThermostatService.prototype.getActions = function() {
	return ["incrementTargetTemperature","decrementTargetTemperature","setTargetTemperature"];
}



AlexaHomematicHMIPThermostatService.prototype.handleEvent = function(event,callback) {
	
	
	console.log("Event %s",JSON.stringify(event));
	var that = this;

	switch (event.header.name) {

		case "SetTargetTemperatureRequest" : {
			var newTemp = event.payload.targetTemperature.value;
			this.setState(this.homematicDevice,"SET_POINT_TEMPERATURE",{"explicitDouble":newTemp});
			callback("Alexa.ConnectedHome.Control","SetTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
		}
		break;

		case "IncrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SET_POINT_TEMPERATURE",function (error,ctemp){
				var newTemp = ctemp + newValue;
				that.setState(that.homematicDevice,"SET_POINT_TEMPERATURE",{"explicitDouble":newTemp});
				callback("Alexa.ConnectedHome.Control","IncrementTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
				
			});
		}
		break;
		
		case "DecrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SET_POINT_TEMPERATURE",function (error,ctemp){
				var newTemp = ctemp - newValue;
				that.setState(that.homematicDevice,"SET_POINT_TEMPERATURE",{"explicitDouble":newTemp});
				callback("Alexa.ConnectedHome.Control","DecrementTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
			});
		}
		break;
		
		
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
		
}


}

module.exports = AlexaHomematicHMIPThermostatService; 