var HarmonyBridge = require(__dirname + '/HarmonyBridge.js').HarmonyBridge;



module.exports = function(server,name,logger) {
	
	this.bridge = new HarmonyBridge(this,name,server,logger);
	this.bridge.init();
	this.name = name;
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.bridge.handleConfigurationRequest(dispatched_request);
    };
}

 
