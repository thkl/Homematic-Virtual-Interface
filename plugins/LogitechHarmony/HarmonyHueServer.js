
//
//  HarmonyHueServer.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";
var DispatchedRequest = require(__dirname + '/DispatchedRequest.js').DispatchedRequest;
var FakeHueDevice = require(__dirname + '/FakeHueDevice.js').FakeHueDevice;
var CCUDevice = require(__dirname + '/CCUDevice.js').CCUDevice;
var RealHueDevice = require(__dirname + '/RealHueDevice.js').RealHueDevice;
var HueApi = require("node-hue-api").HueApi;


var crypto = require('crypto');
var http = require('http');
const EventEmitter = require('events');
const util = require('util');
var url = require("url");
var ssdp = require('@achingbrain/ssdp')




var Method = {
  Service_Lights : require(__dirname + '/methods/lights.js')
}

var HarmonyHueServer = function (plugin) {
	this.name = plugin.name;
	this.plugin = plugin;
	this.log = this.plugin.log;
	this.server = this.plugin.server;
	this.config = this.server.configuration;
	this.initFake = false;
	this.myId = "00178823c4bb";  // Secure Random Number -> https://xkcd.com/221/
	this.bridge = this.server.getBridge();
    this.lights = [];
	this.init();
	EventEmitter.call(this);
	this.linkMode = false;
	this.bus;
}

util.inherits(HarmonyHueServer, EventEmitter);

HarmonyHueServer.prototype.init = function() {
  var that = this;
  
  this.localPort = this.config.getValueForPluginWithDefault(this.name,"port",7000);
  this.hostName = this.config.getValueForPluginWithDefault(this.name,"host",this.getIPAddress());
  this.log.debug("HarmonyHueServer Server Initializing on Port %s",this.localPort);

  function handleRequest(request, response){
	  var dispatched_request = new DispatchedRequest(request,response);
	  that.log.debug("Request %s",dispatched_request.queryPath);
	  that.handleRequest(dispatched_request);
    };
	
	try  {
	//Create a server
	this.server = http.createServer(handleRequest);
	this.server.listen(this.localPort,this.hostName,511, function(){
		that.log.info("HarmonyHueServer Server is listening on: Port %s",that.localPort);
 	});
		
	} catch (e) {
		that.log.error("Cannot init Harmony Server at Port %s Error: %s",that.localPort , e);
	}
 
 	this.udn =  "uuid:2f402f80-da50-11e1-9b23-"+this.myId;
 	
 	this.bus = ssdp({
	  udn:  this.udn , // defaults to a random UUID
	  signature: 'FreeRTOS/6.0.5, UPnP/1.0, IpBridge/0.1',
	  retry : {
	  times: 5, // how many times to attempt joining the UDP multicast group
	  interval: 100 // how long to wait between attempts
  	}
  	});	
 	
 	var options = {};
 	options["usn"]='urn:schemas-upnp-org:device:Basic:1';
 	options["udn"]='uuid:totaly-unique';
 	options["location"] =  {udp4: "http://"+ this.hostName + ":" + this.localPort + "/description.xml"};
 	this.bus.advertise(options);
 	
  // Build the Lights
  
  // Check existing Hue Bridge .. Init and Add Real Lights
  var huePluginName = this.config.getValueForPluginWithDefault(this.name,"hue_plugin_name",undefined);
  if (huePluginName!=undefined) {
	  // load User And IP
	  this.log.info("Adding Real Hue Bridge from %s Plugin",huePluginName);
	  
	  var bridge_ip = this.config.getValueForPluginWithDefault(huePluginName,"hue_bridge_ip",undefined);
	  var bridge_user = this.config.getValueForPluginWithDefault(huePluginName,"hue_username",undefined);
	  if ((bridge_ip != undefined) && (bridge_user != undefined)) {
		  this.hue_api = new HueApi(bridge_ip,bridge_user);
		  // Query Lights
		  that.log.debug("Query Bridge");
		  this.hue_api.lights(function(err, lights) {
			 
		  if ((lights != undefined) && (lights["lights"]!=undefined)) {
		  	lights["lights"].forEach(function (light) {
			  	that.log.debug("Adding new Hue Device to Harmony -> %s",light["name"]);
		  		var realLamp = new RealHueDevice(that,light,that.hue_api);
	  		});
	  	  }
	  	  
	  	  // add the fake Lights
	  	  that.initFakeLights();
		});
	} else {
		this.log.warn("username or bridge ip not found in %s",huePluginName)
	}
  } else {
	  this.log.info("No Hue Pluginname provided in hue_plugin_name. Skipping real Bridge mapping.");
 	  this.initFakeLights();
  }

};


HarmonyHueServer.prototype.initFakeLights = function() {
  if (this.initFake==true) {
		return;
  }
  this.initFake = true;
  this.log.debug("Adding your Fake Lights");
  var that = this;
  var lights = this.plugin.getFakeLights();
  lights.forEach(function (light){
  	that.addFakeLightDevice(light);
  });
}

HarmonyHueServer.prototype.addFakeLightDevice = function(newLight) {
	if ((newLight.type=="0") || (newLight.type=="1")) {
		var fhue = new FakeHueDevice(this,newLight);
	}

	if ((newLight.type=="3") || (newLight.type=="4")) {
		var fhue = new CCUDevice(this,newLight);
	}
}

HarmonyHueServer.prototype.changeFakeLightDevice = function(lightId,newLight) {
	var device = this.getLightDevice(lightId);
	if ((device) && (device.isReal == false ) && (device.hmDevice != undefined)) {
		// Remove the Tmp Data
		this.log.debug("Remove HM Data");
		this.bridge.removeStoredDeviceData(device.hmDevice);
		this.log.debug("Get Light Object");
		this.log.debug("Remove Light Object %s",device.index);
		this.removeLightDevice(device);
		if (newLight != undefined) {
			if ((newLight.type=="0") || (newLight.type=="1")) {
				var fhue = new FakeHueDevice(this,newLight);
			}
			if ((newLight.type=="3") || (newLight.type=="4")) {
				var fhue = new CCUDevice(this,newLight);
			}
		}
	}
}

HarmonyHueServer.prototype.removeLightDevice = function(device) {
   var index = this.lights.indexOf(device);
   if (index > -1) {
    this.log.debug("And its gone");
    this.lights.splice(index, 1);
   } else {
    this.log.debug("Not Found");
   }
}

HarmonyHueServer.prototype.addLightDevice = function(light) {
	// Add Event for StatusRequests
	this.log.debug("Adding new Harmony Hue Device to server %s",light.name);
	this.lights.push(light);
}

HarmonyHueServer.prototype.getLightDevices = function() {
  return this.lights;
}

HarmonyHueServer.prototype.getLights = function() {
  var result = [];
  var ld = this.getLightDevices();
  if (ld != undefined) {
	  ld.forEach(function (lightDevice){result.push(lightDevice.light)});
	  return result;
  } else {
	  return undefined;
  }
  
}


HarmonyHueServer.prototype.getLight = function(lightId) {
  var result = this.getLightDevice(lightId);
  if (result != undefined) {
	  return result.light;
  } else {
	  return undefined;
  }
}

HarmonyHueServer.prototype.getLightDevice = function(lightId) {
  var result = undefined;
	this.lights.forEach(function (lightdevice){
		if (lightdevice.index == lightId) {
			result = lightdevice;
		}
	});
  return result;
}


HarmonyHueServer.prototype.sendDescription = function() {

 var result = "<root xmlns=\"urn:schemas-upnp-org:device-1-0\"><specVersion><major>1</major><minor>0</minor></specVersion>";
 result = result + "<URLBase>http://" + this.hostName +":"+ this.localPort + "/</URLBase>";
 result = result + "<device><deviceType>urn:schemas-upnp-org:device:Basic:1</deviceType><friendlyName>HM Virtual Layer ("+ this.hostName +")</friendlyName>";
 result = result + "<manufacturer>Royal Philips Electronics</manufacturer>";
 result = result + "<manufacturerURL>http://www.philips.com</manufacturerURL>";
 result = result + "<modelDescription>Philips hue Personal Wireless Lighting</modelDescription>";
 result = result + "<modelName>Philips hue bridge 2015</modelName>";
 result = result + "<modelNumber>BSB002</modelNumber>";
 result = result + "<modelURL>http://www.meethue.com</modelURL>";
 result = result + "<serialNumber>" + this.myId + "</serialNumber>";
 result = result + "<UDN>"+ this.udn +"</UDN>";
 result = result + "<presentationURL>index.html</presentationURL></device></root>";

 return result;
}

HarmonyHueServer.prototype.getIPAddress = function() {
    var interfaces = require("os").networkInterfaces();
    for (var devName in interfaces) {
      var iface = interfaces[devName];
      for (var i = 0; i < iface.length; i++) {
        var alias = iface[i];
        if (alias.family === "IPv4" && alias.address !== "127.0.0.1" && !alias.internal)
          return alias.address;
      }
    }
    return "0.0.0.0";
}

HarmonyHueServer.prototype.shutdown = function() {
	this.log.info("HarmonyHueServer Server Shutdown");
	try {		
	this.server.close();
	this.bus.stop(function (error) {});
    } catch (e) {}
}

HarmonyHueServer.prototype.handleRequest = function(dispatched_request) {
    
    var that = this;
	

	if (dispatched_request.method == "POST") {
		dispatched_request.processPost(function() {
          that.internalhandleRequest(dispatched_request)
        });
	} else {
          that.internalhandleRequest(dispatched_request)
	}
}

HarmonyHueServer.prototype.internalhandleRequest = function(dispatched_request) {
	var that = this;

	if (dispatched_request.queryPath == "/description.xml") {
		dispatched_request.sendXMLResponse(this.sendDescription());
		return;
	}
    
	if (dispatched_request.queryComponents.length > 1) {
		var method = dispatched_request.queryComponents[3];
		var user = "";
		if (dispatched_request.queryComponents.length > 2) {
			user = dispatched_request.queryComponents[2];
		}

		if ((dispatched_request.method == "POST") && (user=="")) {
			// TODO: SET SETUPFLAG
			
			if (this.linkMode == true) {
				var token = crypto.randomBytes(10).toString('hex');
				this.addUser(token);
				dispatched_request.sendResponse([{"success":{"username":token}}]);
			} else {
				this.error(dispatched_request,101,path,"link button not pressed" );
			}
			return;			

		} else {	
			if (user != undefined) {
				if (this.validUser(user)) {
				
				// Process Methods here
				if (method=="lights") {
					new Method.Service_Lights(this,dispatched_request).process();
				} else {
					
				// Fallback
				dispatched_request.sendTextResponse("<html><head><title>hue personal wireless lighting</title></head><body><b>Use a modern browser to view this resource.</b></body></html>");
				}
				
				
			} else {
				var path = "/" + dispatched_request.queryComponents.slice(-1)[0] ;
				this.error(dispatched_request,1,path,"unauthorized user" );
			}
		}
	  }
	  return;
	}
	
	this.log.debug("Fallback message");
	dispatched_request.sendTextResponse("<html><head><title>hue personal wireless lighting</title></head><body><b>Use a modern browser to view this resource.</b></body></html>");
}


HarmonyHueServer.prototype.validUser = function(username) {
	var users = this.config.getPersistValueForPlugin(this.name,"user");
	if (users != undefined) {
		var ua = users.split(",");
		return (ua.indexOf(username) > -1);
	}
}

HarmonyHueServer.prototype.addUser = function(username) {
	this.log.debug("AddUser %s",username);
	var users = this.config.getPersistValueForPlugin(this.name,"user");
	if (users == undefined) {
      users = username;
	} else {
	  users = users + "," +username;
	}
	this.config.setPersistValueForPlugin(this.name,"user",users);
	this.linkMode = false;
}

HarmonyHueServer.prototype.validateMethod = function(dispatched_request,allowedMethods,resource) {
  if (allowedMethods.indexOf(dispatched_request.method) > -1) {
	  return true;
  } else {
	  var path = "/" + resource.slice(-1)[0] ;
	  this.error(dispatched_request,4,path,"method, "+dispatched_request.method+", not available for resource, "  + path );
  }
}

HarmonyHueServer.prototype.activateLinkMode = function() {
	this.linkMode = true;
	var that = this;
	this.log.info("Activate Pairing Mode");
	setTimeout(function() {
		that.log.info("Pairing Mode Ended");
		that.linkMode = false;
	}, 30000);
}

HarmonyHueServer.prototype.error = function(dispatched_request,type,address,message) {
  var obj = [{"error":{"type":type,"address":address,"message":message}}];
  dispatched_request.sendResponse(obj);
}



module.exports = {
  HarmonyHueServer : HarmonyHueServer
}
