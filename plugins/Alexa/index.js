

module.exports = function(server,name,logger,instance) {
    var AlexaPlatform = require(__dirname + '/AlexaPlatform')
	this.name = name;
	this.instance = instance;
	this.initialized = false;
	this.platform = new AlexaPlatform(this,name,server,logger,instance);
	this.platform.init();
	
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.platform.handleConfigurationRequest(dispatched_request);
    };
}

 