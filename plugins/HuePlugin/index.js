var HueBridge = require(__dirname + '/HueBridge.js').HueBridge;


module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.bridge = new HueBridge(this,name,server,logger,instance);
	this.bridge.init();
	this.instance = instance;
	this.initialized = false;
	
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 