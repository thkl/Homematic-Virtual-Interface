var SonosBridge = require(__dirname + '/SonosBridge.js').SonosBridge;



module.exports = function(server,name,logger,instance) {
	
	this.initialized = false;
	this.name = name;
	this.instance = instance;
	this.bridge = new SonosBridge(this,name,server,logger);
	this.bridge.init();
		
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 
