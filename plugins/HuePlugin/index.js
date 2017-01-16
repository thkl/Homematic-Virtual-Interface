var HuePlatform = require(__dirname + '/HuePlatform.js');


module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.platform = new HuePlatform(this,name,server,logger,instance);
	this.platform.init();
	this.instance = instance;
	this.initialized = false;
	
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.platform.handleConfigurationRequest(dispatched_request);
    };
}

 