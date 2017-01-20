'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaSonosService(homematicDevice,rpcClient,log,hmlayer) {
    AlexaSonosService.super_.apply(this,arguments);

}

util.inherits(AlexaSonosService, GenericAlexaHomematicService);

AlexaSonosService.prototype.getType = function() {
	return "Sonos Aktor";
}

AlexaSonosService.prototype.getActions = function() {
	return ["turnOn","turnOff","setPercentage"];
}


AlexaSonosService.prototype.handleEvent = function(event,callback) {
	
	
		
	switch (event.header.name) {

		case "TurnOnRequest" : {
				var deviceAdress = event.payload.applianceId;
				var device = this.hm_layer.deviceWithAdress(deviceAdress);
				if (device) {
					var sw_channel = device.getChannelWithTypeAndIndex("KEY","1");
					sw_channel.updateValue("PRESS_SHORT",true,true,true);
					var parameter = sw_channel.getParameterObject("PRESS_SHORT");
					if (parameter) {
						parameter["channel"] = sw_channel.adress;
						sw_channel.emit('channel_value_change', parameter);
					} 
					
					callback("Alexa.ConnectedHome.Control","TurnOnConfirmation");
				} else {
					callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
				}
		}
		break;


		case "TurnOffRequest" : {
				var deviceAdress = event.payload.applianceId;
				var device = this.hm_layer.deviceWithAdress(deviceAdress);
				if (device) {
					var sw_channel = device.getChannelWithTypeAndIndex("KEY","2");
					sw_channel.updateValue("PRESS_SHORT",true,true,true);
					
					var parameter = sw_channel.getParameterObject("PRESS_SHORT");
					if (parameter) {
						parameter["channel"] = sw_channel.adress;
						sw_channel.emit('channel_value_change', parameter);
					} 
					callback("Alexa.ConnectedHome.Control","TurnOffConfirmation");
				} else {
					callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
				}
		}
		break;
		
		
		case "SetPercentageRequest": {
			var newValue = event.payload.percentageState.value;
			
			var deviceAdress = event.payload.applianceId;
			var device = this.hm_layer.deviceWithAdress(deviceAdress);
			if (device) {
					var sw_channel = device.getChannelWithTypeAndIndex("KEY","19");
					// First Fetch 19|MAX_VOLUME -> Max Volume to Set by Alexa
					var max = sw_channel.getParamsetValue("MASTER","MAX_VOLUME");
					
					var i_max = parseInt(max);
					if (i_max == 0) {
						i_max = 20;
					}
					
					if (newValue > i_max) {
						newValue = i_max;
					}
					
					sw_channel.setValue("TARGET_VOLUME",newValue);
					callback("Alexa.ConnectedHome.Control","SetPercentageConfirmation");
			} else {
					callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
			}
		}
		break;


		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
}


}




module.exports = AlexaSonosService; 