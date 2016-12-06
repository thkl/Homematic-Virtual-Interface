var SonosBridge = require(__dirname + '/SonosBridge.js').SonosBridge;



module.exports = function(server,name,logger) {
	
	this.bridge = new SonosBridge(this,name,server,logger);
	this.bridge.init();
	this.name = name;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 
