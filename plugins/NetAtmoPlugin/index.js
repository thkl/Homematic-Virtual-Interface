var NetAtmoBridge = require(__dirname + '/NetAtmoBridge.js').NetAtmoBridge;

module.exports = function(server,name,logger) {
	
	this.bridge = new NetAtmoBridge(this,name,server,logger);
	this.bridge.init();
	this.name = name;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 