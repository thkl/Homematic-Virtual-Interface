
function GenericAlexaHomematicService (homematicDevice,rpcClient,log) {
	this.homematicDevice = homematicDevice;
	this.rpcClient = rpcClient;
	this.log = log;
}


GenericAlexaHomematicService.prototype =  {
	
	
	getActions: function(){return undefined},	
		
	getType : function(){return undefined},
		
	handleEvent: function(event,callback) {},


	setState: function(adress,datapoint,value,callback) {
		this.rpcClient.methodCall("setValue",[adress,datapoint,value], function(error, value) {
			if (callback) {
				callback(value);
			}
		});
	
	},
    
    
    getState: function(adress,datapoint,callback) {
		this.rpcClient.methodCall("getValue",[adress,datapoint], function(error, value) {
			if (callback) {
				callback(error,value);
			}
		});
	
	}
		
}



module.exports = {GenericAlexaHomematicService : GenericAlexaHomematicService}
