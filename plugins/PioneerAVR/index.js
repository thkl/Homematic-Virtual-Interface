var PioneerPlatform = require(__dirname + '/PioneerPlatform');



module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.instance = instance;
	this.platform = new PioneerPlatform(this,name,server,logger,instance);
	this.platform.init();
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.platform.handleConfigurationRequest(dispatched_request);
    };
}

 
