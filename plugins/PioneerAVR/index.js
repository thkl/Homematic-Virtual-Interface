var PioneerBridge = require(__dirname + '/PioneerBridge.js').PioneerBridge;



module.exports = function(server,name,logger,instance) {
	
	this.bridge = new PioneerBridge(this,name,server,logger);
	this.bridge.init();
	this.name = name;
	this.instance = instance;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 
