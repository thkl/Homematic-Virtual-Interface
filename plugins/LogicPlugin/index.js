//
//  Index.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 30.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var LogicalBridge = require(__dirname + '/LogicalBridge.js').LogicalBridge;

"use strict";

module.exports = function(server,name,logger,instance) {
	
	var that = this;
	this.name = name;
	this.instance = instance;

	function init() {
	
	var dependencies = server.configuration.getValueForPlugin(name,"dependencies");
		
	if (server.dependenciesInitialized(dependencies) == true) {
		that.bridge = new LogicalBridge(that,name,server,logger);
		that.bridge.init();
	
		that.handleConfigurationRequest = function(dispatched_request) {
			that.bridge.handleConfigurationRequest(dispatched_request);
    	};
		
	} else {
		logger.debug("have to Wait for someone else %",dependencies);
		setTimeout(function() {
			init();
		}, 1000);
	}
    
    }	
	
	setTimeout(function() {
			init();
		}, 1);
	
}

 