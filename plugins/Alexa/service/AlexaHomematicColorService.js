'use strict';

var GenericAlexaHomematicService = require('./GenericService.js').GenericAlexaHomematicService;
var util = require("util");


function AlexaHomematicColorService(homematicDevice,log,hmlayer,name) {
    AlexaHomematicColorService.super_.apply(this,arguments);
	this.ccuInterface = "BidCos-RF";
}

util.inherits(AlexaHomematicColorService, GenericAlexaHomematicService);



AlexaHomematicColorService.prototype.getType = function() {
	return "setColor";
}


AlexaHomematicColorService.prototype.getActions = function() {
	return ["SetColorRequest"];
}



AlexaHomematicColorService.prototype.handleEvent = function(event,callback) {
	
	var that = this;
	

	switch (event.header.name) {

		case "SetColorRequest" : {
					
			this.setState(this.homematicDevice,"COLOR",{"explicitDouble":1});
			callback("Alexa.ConnectedHome.Control","SetColorConfirmation");
		}
		break;
		
		default:{
			callback("Alexa.ConnectedHome.Control","NoSuchTargetError");
		}
		break;
		
}


}


AlexaHomematicColorService.prototype.setColorChannelValue = function(sw_channel,newLevel) {
	var parameter = sw_channel.getParameterObject("COLOR");
	if (parameter) {
		parameter.newValue = newLevel;
		parameter["channel"] = sw_channel.adress;
		sw_channel.emit('channel_value_change', parameter);
	} 
}

module.exports = AlexaHomematicColorService; 