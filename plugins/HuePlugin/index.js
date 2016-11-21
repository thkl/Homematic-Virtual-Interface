var HueBridge = require(__dirname + '/HueBridge.js').HueBridge;


module.exports = function(server,logger) {
	
	logger.prefix = "HuePlugin";
	this.bridge = new HueBridge(this,server,logger);
	this.bridge.init();
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 