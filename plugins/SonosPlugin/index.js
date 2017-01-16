var SonosPlatform = require(__dirname + '/SonosPlatform');



module.exports = function(server,name,logger,instance) {
	
	this.initialized = false;
	this.name = name;
	this.instance = instance;
	this.platform = new SonosPlatform(this,name,server,logger);
	this.platform.init();
		
	this.handleConfigurationRequest = function(dispatched_request) {
		this.platform.handleConfigurationRequest(dispatched_request);
    };
}

 
