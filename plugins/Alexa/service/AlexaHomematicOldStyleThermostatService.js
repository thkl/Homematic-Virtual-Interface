'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicOldStyleThermostatService(homematicDevice,log,hmlayer,name) {
    AlexaHomematicOldStyleThermostatService.super_.apply(this,arguments);
	this.ccuInterface = "BidCos-RF";
}

util.inherits(AlexaHomematicOldStyleThermostatService, GenericAlexaHomematicService);

AlexaHomematicOldStyleThermostatService.prototype.getType = function() {
	return "Thermostat";
}


AlexaHomematicOldStyleThermostatService.prototype.getActions = function() {
	return ["incrementTargetTemperature","decrementTargetTemperature","setTargetTemperature"];
}



AlexaHomematicOldStyleThermostatService.prototype.handleEvent = function(event,callback) {
	
	
	console.log("Event %s",JSON.stringify(event));
	var that = this;

	switch (event.header.name) {

		case "SetTargetTemperatureRequest" : {
			var newTemp = event.payload.targetTemperature.value;
			this.setState(this.homematicDevice,"SETPOINT",{"explicitDouble":newTemp});
			callback("Alexa.ConnectedHome.Control","SetTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
		}
		break;

		case "IncrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SETPOINT",function (error,ctemp){
				var newTemp = ctemp + newValue;
				that.setState(that.homematicDevice,"SETPOINT",{"explicitDouble":newTemp});
				callback("Alexa.ConnectedHome.Control","IncrementTargetTemperatureConfirmation",{"targetTemperature":{"value":newTemp}});
				
			});
		}
		break;
		
		case "DecrementTargetTemperatureRequest": {
			var newValue = event.payload.deltaTemperature.value || 1;
			this.getState(this.homematicDevice,"SETPOINT",function (error,ctemp){
				var newTemp = ctemp - newValue;
				that.setState(that.homematicDevice,"SETPOINT",{"explicitDouble":newTemp});
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

module.exports = AlexaHomematicOldStyleThermostatService; 