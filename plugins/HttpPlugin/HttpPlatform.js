"use strict";


var path = require('path');
var appRoot = path.dirname(require.main.filename);
if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');

var util = require("util");
var HomematicDevice;
var url = require("url");
var http = require('http');


function HttpPlatform(plugin,name,server,log,instance) {
	HttpPlatform.super_.apply(this,arguments);
	HomematicDevice = server.homematicDevice;
}

util.inherits(HttpPlatform, HomematicVirtualPlatform);


HttpPlatform.prototype.init = function() {

	// get Number of Remotes 
	var num_remotes = this.config.getValueForPluginWithDefault(this.plugin.name,"remotes",1);
	for (var i = 0; i < num_remotes; ++i) {
	 this.initRemote(i);
	}
	
	this.plugin.initialized = true;
	this.log.info("initialization completed %s",this.plugin.initialized);
}


HttpPlatform.prototype.initRemote=function(rmIndex) {
	var that = this;

	var hmDevice = new HomematicDevice();
	var serial = "HTTP_Device_" + rmIndex;
		
	var data = this.bridge.deviceDataWithSerial(serial);
	if (data!=undefined) {
		hmDevice.initWithStoredData(data);
	} 
	
	if (hmDevice.initialized == false) {
		hmDevice.initWithType("HM-RC-19_HTTP", serial);
		this.bridge.addDevice(hmDevice,true);
	} else {
			this.bridge.addDevice(hmDevice,false);
	}
	
	// this will trigered when a value of a channel was changed by the ccu
	hmDevice.on('device_channel_value_change', function(parameter){
		var newValue = parameter.newValue;
		var channel = hmDevice.getChannel(parameter.channel);
		that.log.debug("Channel %s",channel);
		if (channel) {
			var strurl = that.functionForChannel(channel,parameter.name);
			if (strurl) {
				http.get(strurl);
			}
		}
	});
}

HttpPlatform.prototype.functionForChannel=function(channel,type) {
	if (channel) {
		var result = channel.getParamsetValueWithDefault("MASTER","CMD_" + type,"");
		// replace ~ 61 with = and ~26 with &
		this.log.debug("Getting %s Result is %s","CMD_" + type,result);
		if (result) {
			result = result.replace(/\~61/g, '=');
			result = result.replace(/\~26/g, '&');
		}
		this.log.debug("Getting %s Result is %s","CMD_" + type,result);
		return result;
	} else {
		return undefined;
	}
}

HttpPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var that = this;
	var template = "index.html";
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;

	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
			
			case "app.js":
			{
				template="app.js";
			}
			break;
			
		}
	}
	
	dispatched_request.dispatchFile(this.plugin.pluginPath , template ,{"listDevices":""});

}

module.exports = HttpPlatform;
