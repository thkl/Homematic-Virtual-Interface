'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }
appRoot = path.normalize(appRoot);
var xmlrpc = require(appRoot + "/homematic-xmlrpc");
var dcLogger = require(appRoot + "/logger.js").logger("DutyCycle");


var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')

function CCUDutyCycle (plugin, name, server, log, instance) {
  CCUDutyCycle.super_.apply(this, arguments)
}

util.inherits(CCUDutyCycle, HomematicVirtualPlatform)

CCUDutyCycle.prototype.init = function () {
  var that = this
  this.dutyCycle = {};
  
  this.bridge.addRPCClient('BidCos-RF')

  this.queryCCU();

  this.plugin.initialized = true;

  this.log.info('initialization completed %s', this.plugin.initialized)
}


CCUDutyCycle.prototype.queryCCU = function () {
	var that = this;
	
	this.bridge.callRPCMethod('BidCos-RF','listBidcosInterfaces',[], function(error, value) {
		if (value) {
			value.some(function (ccuInterface){
				var adr = ccuInterface.ADDRESS
				var dc = ccuInterface.DUTY_CYCLE
				var tp = ccuInterface.TYPE
				that.dutyCycle[adr] = {'adress':adr,'dutycycle':dc,'type':tp};
				dcLogger.info("Interface %s Type %s DutyCycle %s",adr,tp,dc);
			});
		}		
	});
	setTimeout(function () {
		that.queryCCU();
	}, 60000);
}

CCUDutyCycle.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query

  var dutyCycle = "";
  var that = this;
  
  var requesturl = dispatchedRequest.request.url;
  var queryObject = url.parse(requesturl,true).query;
  if (queryObject["do"]!=undefined) {
		
  switch (queryObject["do"]) {
  	
  	case "showlog": {

		var options = {
			start:  0,
			rows: 9999999,
			order:  'desc',
			fields: ['message','label','level','timestamp']
		};
				
			dcLogger.query(options, function (err, result) {
				var str = "";
				result.dailyRotateFile.some(function (msg){
					if (msg.label==="DutyCycle") {
						str = str + msg.timestamp  + "  [" + msg.level + "] - " + msg.message + "\n";
					}
				})
	 			dispatchedRequest.dispatchFile(that.plugin.pluginPath , "log.html" ,{"logData":str});
 			});

			 return;		  
	}
  	break;

  }	  	
  
  } else {
  		var dctemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_dc_tmp.html",null);
  		Object.keys(this.dutyCycle).forEach(function (ccuInterface) {
  			var dco = that.dutyCycle[ccuInterface];
  			dutyCycle = dutyCycle +  dispatchedRequest.fillTemplate(dctemplate,{"adress":dco["adress"],"type":dco["type"],"dutycycle":dco["dutycycle"]});
  		});
  		dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'dutyCycle': dutyCycle})
  }   
}

module.exports = CCUDutyCycle
