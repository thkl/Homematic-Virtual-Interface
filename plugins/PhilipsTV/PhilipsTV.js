//
//  PhilipsTV.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.01.2017
//  Copyright © 2017 kSquare.de. All rights reserved.
//


"use strict";

var request = require('request');
var HomematicDevice;
	
var PhilipsTV = function(plugin,name,server,log,instance) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.instance = (instance) ? instance:"0";
	this.configuration = this.server.configuration;
	this.lampData = {};
	this.layers = 0;
	this.leftPixels = 0;
	this.topPixels = 0;
	this.rightPixels = 0;
	this.bottomPixels = 0;
	this.curPix = 0;
	this.bridge = this.server.getBridge();
	
	HomematicDevice = this.server.homematicDevice;
}

PhilipsTV.prototype.init = function() {
	this.log.info("Init %s",this.name);
	this.tv_ip = this.configuration.getValueForPlugin(this.name,"tv_ip");
	var that = this;	

	var api_id = this.configuration.getPersistValueForPlugin(this.name,"api_id");
	if (api_id) {
		this.api_id = api_id;
		this.log.debug("using cached Philips API Version %s",that.api_id);
		this.getTopology();
	} else {

 	request('http://' + this.tv_ip + ":1925/system", function (error, response, body) {
	if (!error && response.statusCode == 200) {
		try {
			
			var system = JSON.parse(body);
			if (system) {
				that.api_id = system["api_version"]["Major"];
				that.log.debug("Philips API Version is %s",that.api_id);
				that.configuration.setPersistValueForPlugin(that.name,"api_id",that.api_id);
				that.getTopology();
			}	
			
		} catch (e) {}
  	} else {
	  	that.log.error("TV Init failed %s",error);
  	}
	});
	
	}
	
	// Generate HM Actor
	

	
	this.hmDevice = new HomematicDevice();
	this.hmDevice.initWithType("VIR-LG-RGBW-DIM", "PhilipsTV");
	this.bridge.addDevice(this.hmDevice);

	this.hmDevice.on('device_channel_value_change', function(parameter){
		var newValue = parameter.newValue;
		var channel = that.hmDevice.getChannel(parameter.channel);

	    if (parameter.name == "LEVEL") {

		    channel.startUpdating("LEVEL");
			channel.updateValue("LEVEL",newValue);
		    
		    if (newValue==1) {
			    that.switchMode("internal",function() {
					channel.endUpdating("LEVEL");
			    });
		    } else {
			    that.curPix = 0;
				that.loadCurrentLampData(function () {
					that.switchOff(10, function () {
					channel.endUpdating("LEVEL");
					});
				});
		    }
		    
		}
		
		
		if (parameter.name == "RGBW") {
			channel.startUpdating("RGBW");
			channel.updateValue("RGBW",newValue);

			that.loadCurrentLampData(function () {

			var regex = /(\s*[0-9]{1,3}),(\s*[0-9]{1,3}),(\s*[0-9]{1,3})/
			var result = newValue.match(regex);
			var r = parseInt(result[1]);
			var g = parseInt(result[2]);
			var b = parseInt(result[3]);
			for (var i = 0;i<=that.pixels;i++) {
				that.switchPixelToColor(1,i,r,g,b);	
			}
			});
			
			
			
			that.switchMode("manual",function() {
				that.sendLampData(function () {
				channel.endUpdating("RGBW");
			});
			});
			
			
		}
		
	});
}


PhilipsTV.prototype.getTopology = function() {
	this.log.debug("loading topology");
	var that = this;	
	var topo = this.configuration.getPersistValueForPlugin(this.name,"topology");
	if (topo) {
		var topology = JSON.parse(topo);
		this.log.debug("used cached topology");
		this.parseTopology(topology);
		return;		
	} else {
		
	 	request('http://' + this.tv_ip + ":1925/" +  this.api_id + "/ambilight/topology", function (error, response, body) {
	 	if (!error && response.statusCode == 200) {
			try {
				var topology = JSON.parse(body);
				if (topology) {
					that.configuration.setPersistValueForPlugin(that.name,"topology",JSON.stringify(topology));
					that.parseTopology(topology);
				} else {
					that.log.error("Topology not readable");
				}	
				} catch (e) {that.log.error(e)}
  		} else {
	  		that.log.error("TV Ambilight Topology request failed %s",error);
  		}
		});
	}
}

PhilipsTV.prototype.parseTopology = function(topology) {
	
	this.layers = topology.layers;
	this.leftPixels = topology.left;
	this.topPixels = topology.top;
	this.rightPixels = topology.right;
	this.bottomPixels = topology.bottom;
	this.pixels = (this.leftPixels + this.topPixels + this.rightPixels + this.bottomPixels);
	this.log.debug("Topology loaded %s pixels.",this.pixels);

}


PhilipsTV.prototype.switchOff = function(delay,callback) {
	
	var that = this;
	if (this.curPix > this.pixels) {
		callback();
		return;
	}
	this.switchPixelToColor(1,this.curPix,0,0,0);	
	this.curPix = this.curPix + 1;

	that.switchMode("manual",function() {
		that.sendLampData(function () {
			setTimeout(function(){
				that.switchOff(delay,callback);
			}, delay);	
		});
	});		

	
}

PhilipsTV.prototype.loadCurrentLampData = function(callback) {
	var that = this;
	request('http://' + this.tv_ip + ":1925/" +  this.api_id + "/ambilight/processed", function (error, response, body) {
	if (!error && response.statusCode == 200) {
		try {
			that.lampData = JSON.parse(body);
			callback()
		} catch (e) {that.log.error(e)}
    }
    });
}


PhilipsTV.prototype.sendLampData = function(callback) {
	var that = this;
	this.log.debug(JSON.stringify(this.lampData));
	this.sendCommand("ambilight/cached",JSON.stringify(this.lampData),function (error,response){
		callback();
	});
}

PhilipsTV.prototype.switchMode = function(newMode,callback) {
	var that = this;

	var modeRequest = "{\"current\":\""+newMode+"\"}";
	this.sendCommand("ambilight/mode",modeRequest,function (error,response){
		callback();
	});
}



PhilipsTV.prototype.switchPixelToColor = function(layer,pixelId,red,green,blue) {
	if (this.pixels > 0) {
	  if (pixelId <= this.pixels) {
		  var side = "left";
		  var pixel = pixelId;
		  
		  if (pixelId>this.leftPixels) {
			  side = "top";
			  pixel = pixelId - (this.leftPixels)-1;
		  }
		  
		  if (pixelId>(this.leftPixels + this.topPixels)) {
			  side = "right";
			  pixel = pixelId - (this.leftPixels + this.topPixels)-1;
		  }
		  
		  if (pixelId>(this.leftPixels + this.topPixels + this.rightPixels)) {
			  side = "bottom";
			  pixel = pixelId - (this.leftPixels + this.topPixels + this.rightPixels)-1;
		  }
		 
		  try {
			  this.lampData["layer"+layer][side][pixel]["r"]=red;
			  this.lampData["layer"+layer][side][pixel]["g"]=green;
			  this.lampData["layer"+layer][side][pixel]["b"]=blue;
			  
		  } catch (e){}
	  }	
  	}
}

PhilipsTV.prototype.sendCommand = function(path,data,callback) {
	var url = 'http://' + this.tv_ip + ':1925/' +  this.api_id + '/' + path;
	var that = this;
request(
    { method: 'POST'
    , uri: url
    , body: data
    
    }
  , function (error, response, body) {
	  callback(error,body);
    }
  );
}


PhilipsTV.prototype.handleConfigurationRequest = function(dispatched_request) {
	dispatched_request.dispatchFile(this.plugin.pluginPath , "index.html",undefined);
}


module.exports = {
  PhilipsTV : PhilipsTV
}



