'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHueService(homematicDevice,rpcClient,log,hmlayer) {
    AlexaHueService.super_.apply(this,arguments);
}

util.inherits(AlexaHueService, GenericAlexaHomematicService);



AlexaHueService.prototype.getType = function() {
	return "Hue Dimmer";
}


AlexaHueService.prototype.getActions = function() {
	return ["turnOn","turnOff","setPercentage","incrementPercentage","decrementPercentage"];
}



AlexaHueService.prototype.handleEvent = function(event,callback) {
	
	var that = this;
	var deviceAdress = event.payload.appliance.applianceId;

	var device = this.hm_layer.deviceWithAdress(deviceAdress);
		if (device) {
		var di_channel = device.getChannelWithTypeAndIndex("DIMMER","1");

		switch (event.header.name) {

			case "TurnOnRequest" : {
				this.setChannelValue(di_channel,1);
				callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
			}
		break;


			case "TurnOffRequest" : {
				this.setChannelValue(di_channel,0);
				callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
			}
		break;
		
			case "SetPercentageRequest": {
				var newValue = event.payload.percentageState.value;
				this.setChannelValue(di_channel,newValue/100);
				callback("Alexa.ConnectedHome.Control","SetPercentageConfirmation");
			}
		break;

			case "IncrementPercentageRequest": {
				var newValue = event.payload.deltaPercentage.value;
				var level = di_channel.getValue("LEVEL");
				var newLevel = (level * 100) + newValue;
				this.setChannelValue(di_channel,newValue/100);
				callback("Alexa.ConnectedHome.Control","IncrementPercentageConfirmation");
			}
			
		break;
		
		case "DecrementPercentageRequest": {
			var newValue = event.payload.deltaPercentage.value;
				var level = di_channel.getValue("LEVEL");
				var newLevel = (level * 100) - newValue;
				this.setChannelValue(di_channel,newValue/100);
				callback("Alexa.ConnectedHome.Control","DecrementPercentageConfirmation");
			}
			
		break;
		
		
			default:{
				callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
			}
			
		break;
		
		}
	} else {
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
	}

}

AlexaHueService.prototype.setChannelValue = function(sw_channel,newLevel) {
	var parameter = sw_channel.getParameterObject("LEVEL");
	if (parameter) {
		parameter.newValue = newLevel;
		parameter["channel"] = sw_channel.adress;
		sw_channel.emit('channel_value_change', parameter);
	} 
}


module.exports = AlexaHueService; 