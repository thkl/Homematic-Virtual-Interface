var PhilipsTV = require(__dirname + '/PhilipsTV.js').PhilipsTV;


module.exports = function(server,name,logger,instance) {
	
	this.name = name;
	this.tv = new PhilipsTV(this,name,server,logger,instance);
	this.tv.init();
	this.instance = instance;
	this.initialized = false;
	
	
	this.handleConfigurationRequest = function(dispatched_request) {
		this.tv.handleConfigurationRequest(dispatched_request);
    };
}

 