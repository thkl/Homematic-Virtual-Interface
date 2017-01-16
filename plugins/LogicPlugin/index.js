//
//  Index.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 30.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var LogicalPlatform = require(__dirname + '/LogicalPlatform');

"use strict";

module.exports = function(server,name,logger,instance) {
	
	var that = this;
	this.name = name;
	this.instance = instance;

	function init() {
	
	var dependencies = server.configuration.getValueForPlugin(name,"dependencies");
		
	if (server.dependenciesInitialized(dependencies) == true) {
		that.platform = new LogicalPlatform(that,name,server,logger);
		that.platform.init();
	
		that.handleConfigurationRequest = function(dispatched_request) {
			that.platform.handleConfigurationRequest(dispatched_request);
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

 