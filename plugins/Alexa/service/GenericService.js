//
//  GenericAlexaHomematicService.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 15.01.17.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var fs = require('fs');
var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
var regarequest = require(appRoot + "/HomematicReqaRequest.js");


function GenericAlexaHomematicService (homematicDevice,rpcClient,log,hmlayer) {
	this.homematicDevice = homematicDevice;
	this.rpcClient = rpcClient;
	this.log = log;
	this.hm_layer = hmlayer; 
	this.alexaname = "unknow";
}


GenericAlexaHomematicService.prototype =  {
	
	
	getActions: function(){return undefined},	
		
	getType : function(){return undefined},
		
	handleEvent: function(event,callback) {},

	sendRega : function(script,callback) {
		new regarequest(this.hm_layer,script,callback);
	},

	getPhrases: function(lng){
		var that = this;
    	var result = [];
		
		try {

		var buffer = fs.readFileSync(__dirname + '/phrases.json');
    	var phrases = JSON.parse(buffer.toString());
    	if (phrases) {
	    	
	    	this.getActions().forEach(function (action){
		    	
		    	var phrase = phrases[action];
		    	if (phrase) {
			    	var localized_phrase = phrase[lng];
			    	if (localized_phrase) {
				    	result.push(localized_phrase.split("$device$").join(that.alexaname));
			    	}
		    	}
	    	});
    	}
    	} catch (e){}
    	return result;
	},	


	setState: function(adress,datapoint,value,callback) {
		this.rpcClient.methodCall("setValue",[adress,datapoint,value], function(error, value) {
			if (callback) {
				callback(value);
			}
		});
	
	},
    
    
    getState: function(adress,datapoint,callback) {
		this.rpcClient.methodCall("getValue",[adress,datapoint], function(error, value) {
			if (callback) {
				callback(error,value);
			}
		});
	
	}
		
}



module.exports = {GenericAlexaHomematicService : GenericAlexaHomematicService}
