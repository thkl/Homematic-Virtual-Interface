var AlexaBridge = require(__dirname + '/AlexaBridge.js').AlexaBridge;


module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.instance = instance;
	this.initialized = false;
	this.bridge = new AlexaBridge(this,name,server,logger,instance);
	this.bridge.init();
	
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 