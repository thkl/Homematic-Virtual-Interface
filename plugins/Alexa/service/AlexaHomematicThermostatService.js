'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicThermostatService(plugin,homematicDevice,rpcClient,log,hmlayer) {
    AlexaHomematicThermostatService.super_.apply(this,arguments);
}

util.inherits(AlexaHomematicThermostatService, GenericAlexaHomematicService);

AlexaHomematicThermostatService.prototype.getType = function() {
	return "Thermostat";
}


AlexaHomematicThermostatService.prototype.getActions = function() {
	return ["incrementTargetTemperature","decrementTargetTemperature","setTargetTemperature"];
}



AlexaHomematicThermostatService.prototype.handleEvent = function(event,callback) {
	
	
	console.log("Event %s",JSON.stringify(event));
	var that = this;

	switch (event.header.name) {

		case "SetTargetTemperatureRequest" : {
			var newTemp = event.payload.targetTemperature.value;
			this.setState(this.homematicDevice,"SET_TEMPERATURE",{"explicitDouble":newTemp});
			callback("Alexa.ConnectedHome.Control","SetTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
		}
		break;

		case "IncrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SET_TEMPERATURE",function (error,ctemp){
				var newTemp = ctemp + newValue;
				that.setState(that.homematicDevice,"SET_TEMPERATURE",{"explicitDouble":newTemp});
				callback("Alexa.ConnectedHome.Control","IncrementTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
				
			});
		}
		break;
		
		case "DecrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SET_TEMPERATURE",function (error,ctemp){
				var newTemp = ctemp - newValue;
				that.setState(that.homematicDevice,"SET_TEMPERATURE",{"explicitDouble":newTemp});
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

module.exports = AlexaHomematicThermostatService; 