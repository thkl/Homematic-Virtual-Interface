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
	return ["turnOn","turnOff"];
}


AlexaSonosService.prototype.handleEvent = function(event,callback) {
	
	
		
	switch (event.header.name) {

		case "TurnOnRequest" : {
				var deviceAdress = event.payload.appliance.applianceId;
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
					sw_channel.updateValue("PRESS_SHORT",false,false,false);
				} else {
					callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
				}
		}
		break;


		case "TurnOffRequest" : {
				var deviceAdress = event.payload.appliance.applianceId;
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
					sw_channel.updateValue("PRESS_SHORT",false,false,false);
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