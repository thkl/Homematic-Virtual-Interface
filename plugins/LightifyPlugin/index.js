var LightifyBridge = require(__dirname + '/LightifyBridge.js').LightifyBridge;

module.exports = function(server,name,logger) {
	
	this.bridge = new LightifyBridge(this,name,server,logger,instance);
	this.bridge.init();
	this.name = name;
	this.instance = instance;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 