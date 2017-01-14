"use strict";

var xmlrpc = require(__dirname + "/../../lib/homematic-xmlrpc");
var uuid = require('uuid');
var HomematicDevice;

var AlexaBridge = function(plugin,name,server,log,instance) {
	this.plugin = plugin;
	this.server = server;
	this.log = log;
	this.name = name;
	this.instance = (instance) ? instance:"0";
	this.alexa_appliances = {};
	HomematicDevice = server.homematicDevice;
}


AlexaBridge.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
	this.log.debug("Name %s",this.name);
	this.api_key =  this.configuration.getValueForPlugin(this.name,"api_key");

	if (this.api_key == undefined) {
		this.log.error("Missing api_key ... you can get one from https://console.ksquare.de/alexa");
	} else {

	this.hm_layer = this.server.getBridge();
	
	    // Publish Server to CCU
    var ccuIP =  this.hm_layer.ccuIP;
    this.log.debug("CCU is at %s",ccuIP);
    this.client = xmlrpc.createClient({
      host: ccuIP,
      port: 2001,
      path: "/"
    });
    
    this.reloadApplicances();
	
	this.log.info("Cloud Login with Api Key %s",this.api_key);
		
	var socket = require('socket.io-client')('http://console.ksquare.de:3000',{
        rejectUnauthorized: false,
        reconnectionDelay:    5000,
        reconnectionDelayMax: 10000
    });

	socket.on('connect', function () {
        that.log.info('Connection changed: CONNECTED');
        socket.send(JSON.stringify({"key":that.api_key}));
    });

    socket.on('disconnect', function () {
        that.log.info('Connection changed: DISCONNECTED');
    });

    socket.on('error', function (error){
        that.log.error('Connection error: ' + error);
        console.log('error: ' + error);
    });
    
    socket.on('alexa', function (data) {
		try {
		var alx_message = JSON.parse(data);
		if (alx_message) {
			that.log.info("Message : %s",JSON.stringify(alx_message));
			switch (alx_message.header.name) {
			
				case "DiscoverAppliancesRequest" : {
					that.log.info("Discover Request");
					var result = that.generateResponse("Alexa.ConnectedHome.Discovery","DiscoverAppliancesResponse", {"discoveredAppliances":that.get_appliances()});
					that.log.info(result);
					socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {
						console.log(data); // data will be 'woot'
					});
				}
				break;
				
				case "HealthCheckRequest" : {
					var result = that.generateResponse("Alexa.ConnectedHome.System","HealthCheckResponse", {"description":"Iam alive","isHealthy":true});
					that.log.info(result);
					socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {
						console.log(data); // data will be 'woot'
					});
				}
				break;

				
				default:
				{
					var ap_id = alx_message.payload.appliance.applianceId;
					if (ap_id) {
						var ap_obj = that.alexa_appliances[ap_id];
						if (ap_obj) {
							var hms = ap_obj.service;
							if (hms) {
								hms.handleEvent(alx_message,function(responseNameSpace,responseName,response_payload){
									var result = that.generateResponse(responseNameSpace,responseName, response_payload);
									socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {});
								});
							}
						}
					}
				}
				break;
			}	
			
		}
		} catch (e) {
			that.log.error("Event Error",e,e.stack);
			socket.send(JSON.stringify({"key":that.api_key,"result":"error"}), function (data) {
						console.log(data); // data will be 'woot'
					});

		}
		
	});
	}
	
	 this.plugin.initialized = true;
	 this.log.info("initialization completed %s",this.plugin.initialized);
}

AlexaBridge.prototype.reloadApplicances = function() {
	this.alexa_appliances = {};
	var that = this;
    var p_applicances = this.configuration.loadPersistentObjektfromFile("alexa_objects");
    var objects = p_applicances["alexa"];
    if (objects) {
	    objects.forEach(function (alexa_object) {
			that.log.info("Adding %s to Alexa",alexa_object.name);
	
			if (alexa_object.type=="AlexaLogicService") {
				that.add_virtual_appliance(alexa_object.adress,alexa_object.name,alexa_object.type);
			} else {
				that.add_appliance(alexa_object.adress,alexa_object.name,alexa_object.type);
			}
			
	    });
    } else {
	    this.log.info("There are no objects for alexa");
    }
    
}

AlexaBridge.prototype.generateResponse = function(nameSpace,cmdname, response_payload) {

  var header = {};
  header["messageId"] = uuid.v1();
  header["namespace"] = nameSpace;
  header["name"] = cmdname;
  header["payloadVersion"] ="2";

  
  var payload = response_payload || {};
  
  return {"header":header,"payload":payload};
}

AlexaBridge.prototype.get_appliances = function() {
  var result = [];
  var that = this;
  Object.keys(this.alexa_appliances).forEach(function (key) {
	  var ap_obj = that.alexa_appliances[key];
	  result.push(ap_obj.alexa);
  });
  return result;
}


AlexaBridge.prototype.add_appliance = function(id,name,hmService) {

  var service = require ('./service/' + hmService);
  var hms = new service(id,this.client,this.log);


  var al_ap = {"applianceId":id,
	  "manufacturerName":"ksquare.de",
	  "modelName" : "Homematic Actor",
	  "version": "1",
	  "friendlyName": name,
	  "friendlyDescription": hms.getType() ,
	  "isReachable": true,
	  "additionalApplianceDetails": {
          "fullApplianceId": uuid.v1()
      }
  }
  
  al_ap["actions"] = hms.getActions();
  this.alexa_appliances[id] = {"alexa":al_ap,"service":hms};
  return hms;
}

AlexaBridge.prototype.add_virtual_appliance = function(id,name,hmService) {
	var hmDevice = new HomematicDevice();
	hmDevice.initWithType("HM-LC-Sw1-Pl", id );
	this.hm_layer.addDevice(hmDevice,false,true); // Hide device from CCU
	
	var hms = this.add_appliance(id,name,hmService);
	hms.virtual_device = hmDevice;
}



AlexaBridge.prototype.handleConfigurationRequest = function(dispatched_request) {
}

module.exports = {
  AlexaBridge : AlexaBridge
}
