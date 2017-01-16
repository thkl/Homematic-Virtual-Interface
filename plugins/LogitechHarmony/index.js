var HarmonyPlatform = require(__dirname + '/HarmonyPlatform');



module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.instance = instance;
	this.platform = new HarmonyPlatform(this,name,server,logger,instance);
	this.platform.init();
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.platform.handleConfigurationRequest(dispatched_request);
    };
}

 
