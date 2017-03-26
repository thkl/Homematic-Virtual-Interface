'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }
appRoot = path.normalize(appRoot);
var xmlrpc = require(appRoot + "/homematic-xmlrpc");
var groupArray = require('group-array')
var moment = require("moment")
var fs	= require('fs');

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

  try {
	var dbLogger = require('nedb-logger')
	var logDir = path.join(this.config.storagePath(),'logs')
	if (!fs.existsSync(logDir)){
    	fs.mkdirSync(logDir);
	}

	this.db = new dbLogger({ filename: path.join(logDir, 'dc.db')});

	} catch (e) {
		this.log.error("Error while initializing db %s",e);
	}

	setTimeout(function () {
		that.clean()
	}, 3600000)
  this.clean();
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
				that.dutyCycle[adr] = {'adress':adr,'dutycycle':dc,'type':tp}
				if (that.db) {
					 that.db.insert({'time':new Date(),'interface':adr,'dc':dc})
				}
			});
		}		
	});
	setTimeout(function () {
		that.queryCCU();
	}, 60000);
}

CCUDutyCycle.prototype.clean = function() {
	this.log.info("Cleaning old DC entries")
	var that = this
	var hours = 24
	var ts = new Date().getTime() - (hours*3600000)
	var Database = require('nedb')
	var logDir = path.join(this.config.storagePath(),'logs')
	var db = new Database({ filename: path.join(logDir, "dc.db") });
	db.loadDatabase(function (err) {  
		if (err) {
			that.log.error("Error while loading logging db %s",err)
			return
		} else {
			that.log.info("DB found going ahead")		
				db.remove({time : { $lt: new Date(ts) }}, { multi: true }, function (err, numRemoved) {
					that.log.info("Removed %s entries from DC Table",numRemoved)
					db.persistence.compactDatafile()
				});
		}
	});
}

CCUDutyCycle.prototype.generateChart = function(callback) {
	var timelines = []
	var datasets = []
	var that = this
	
	
	var borderColors = [
                'rgba(255,99,132,1)',
                'rgba(54, 162, 235, 1)',
                'rgba(255, 206, 86, 1)',
                'rgba(75, 192, 192, 1)',
                'rgba(153, 102, 255, 1)',
                'rgba(255, 159, 64, 1)'
            ]
            
            
	var ts = new Date().getTime() - 86400000
	
	var Database = require('nedb')
	var logDir = path.join(this.config.storagePath(),'logs')
	var db = new Database({ filename: path.join(logDir, "dc.db") });
	db.loadDatabase(function (err) {  
		if (err) {
			that.log.error("Error while loading logging db %s",err)
			return
		}
	});
	
	db.find({time :{$gt: new Date(ts)}}).sort({time: 1 }).exec(function (err, docs) {
	
	  var elements = []

	  docs.some(function (record){
	    elements.push({'interface':record['interface'],'time':record.time,'dc':record.dc})
	  })

	  var result = groupArray(elements,'interface')
	  var index = 0
	  Object.keys(result).forEach(function (ifname) {
	  	var dataset = {}
	  	var rv = []
	  	var rt = []
	  	var x = 0;
	  	result[ifname].some(function (record){
		  	rv.push({'x':x,'y':record.dc});
			  	x = x + 1
		  	var ts = moment.utc(record.time.getTime())
		  	var strts = ts.format("D.MM.YYYY HH:mm");
		  	if (timelines.indexOf(strts)==-1) {
			  	timelines.push(strts)
		  	}
	  	})
	  	
	  	
	  	dataset.label = ifname
		dataset.data = rv
		dataset.pointRadius = 0
		dataset.backgroundColor = borderColors[index]
		dataset.borderColor = borderColors[index]
		dataset.borderWidth = 1
		dataset.fill = false
		dataset.lineTension = 0.1
		dataset.pointStyle = "line"
		dataset.pointHitRadius = 5
		datasets.push(dataset)
		index = index+1
	  })
	  
	  
	  callback(datasets,timelines)
	});	
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
  	
  	case "loadvalues": {
  		
 
			this.generateChart(function (datasets,timelines) {		
	 			dispatchedRequest.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify({"datasets":datasets,"timelines":timelines})});
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
