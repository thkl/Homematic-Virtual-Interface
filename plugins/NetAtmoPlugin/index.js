var NetAtmoBridge = require(__dirname + '/NetAtmoBridge.js').NetAtmoBridge;

module.exports = function(server,name,logger,instance) {
	
	this.bridge = new NetAtmoBridge(this,name,server,logger);
	this.bridge.init();
	this.name = name;
	this.instance = instance;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 