"use strict";


var path = require('path');
var appRoot = path.dirname(require.main.filename);
var fs = require("fs");

if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith("node_modules/daemonize2/lib")) {appRoot =  appRoot+"/../../../lib";}
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js');
var alexaLogger = require(appRoot + "/logger.js")("AlexaEvent");

var util = require("util");
var xmlrpc = require(appRoot + "/homematic-xmlrpc");
var uuid = require('uuid');
var HomematicDevice;
var url = require("url");
var regaRequest = require(appRoot + "/HomematicReqaRequest.js");

function AlexaPlatform(plugin,name,server,log,instance) {
	AlexaPlatform.super_.apply(this,arguments);
	this.alexa_appliances = {};
	this.hasSettings = true;
	this.server = server;
	HomematicDevice = server.homematicDevice;
}

util.inherits(AlexaPlatform, HomematicVirtualPlatform);


AlexaPlatform.prototype.init = function() {
	var that = this;
	this.configuration = this.server.configuration;
	this.api_key =  this.configuration.getValueForPlugin(this.name,"api_key");
	this.maxdelta =  this.configuration.getValueForPluginWithDefault(this.name,"max_delta",10000);
	this.ccu_varname = this.configuration.getValueForPluginWithDefault(this.name,"ccu_varname","");
	this.authenticated = false;
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

	alexaLogger.info("Alexa Plugin launched ..");

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
	
	this.log.info("Cloud Login with Api Key XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX");
	alexaLogger.info("Connecting to Cloud Service");


	this.socket = require('socket.io-client')('https://console.ksquare.de:3000',{
        rejectUnauthorized: false,
        reconnectionDelay:    5000,
        reconnectionDelayMax: 10000
    });



	this.socket.on('connect', function () {
        that.log.info('Connection changed: CONNECTED');
	    that.authenticated = false;
        that.socket.emit('authentication', {token: that.api_key});
	});
    
    this.socket.on('authenticated', function() {
	    that.authenticated = true;
	    that.log.info('Connection changed: AUTHENTICATED');
	    alexaLogger.info("Authentication Passed");
	});

    this.socket.on('unauthorized', function() {
	    that.authenticated = false;
	    alexaLogger.info("Authentication failure. Please check your API Key");
	});


    this.socket.on('disconnect', function () {
 	    that.authenticated = false;
        that.log.info('Connection changed: DISCONNECTED');
    });

    this.socket.on('error', function (error){
        that.log.error('Connection error: ' + error);
        console.log('error: ' + error);
    });
    
    this.socket.on(that.api_key, function (data,timestamp) {
		try {
		var alx_message = JSON.parse(data);
		if ((alx_message) && (that.authenticated == true) && (timestamp)) {
			var myTime = new Date().getTime();
			var delta = timestamp-myTime;
			if ((delta < (0-that.maxdelta)) || (delta>that.maxdelta)) {
				alexaLogger.info("Drop Message. Timestamp is out of range.");
				that.log.warn("Drop Message because timestamp is out of range %s. Please take care of your clock !!.",that.maxdelta);
				return;
			}
			that.log.info("Message : %s at %s Delta %s",JSON.stringify(alx_message),timestamp,delta);
			
			switch (alx_message.header.name) {
			
				case "DiscoverAppliancesRequest" : {
					that.log.info("Discover Request");
					alexaLogger.info("Alexa Discovery Event");

					var result = that.generateResponse("Alexa.ConnectedHome.Discovery","DiscoverAppliancesResponse", {"discoveredAppliances":that.get_appliances()});
					that.log.info(result);
					that.socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {
						console.log(data); // data will be 'woot'
					});
				}
				break;
				
				case "HealthCheckRequest" : {
					alexaLogger.info("Alexa Ping Event");
					var result = that.generateResponse("Alexa.ConnectedHome.System","HealthCheckResponse", {"description":"Iam alive","isHealthy":true});
					that.log.info(result);
					that.socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {
						console.log(data); // data will be 'woot'
					});
				}
				break;

				
				default:
				{
					if ((that.ccu_varname) && (that.ccu_varname.length>0)) {
						// Check if the enable Variable is enabled :-)
						that.log.debug("Checking enabler %s",that.ccu_varname);
						new regaRequest(that.hm_layer,"var x = dom.GetObject('"+that.ccu_varname+"');if (x) {Write(x.Variable());}",function (result) {

							if (result=="1") {
								that.processAlexaMessage(alx_message);
							} else {
								// Send Failure back to alexa
								var result = that.generateResponse("Alexa.ConnectedHome.Control","NoSuchTargetError", null);
								that.socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {});
							}
						});

					} else {
						that.processAlexaMessage(alx_message);
					}
					
				}
				break;
			}	
			
		}
		} catch (e) {
			that.log.error("Event Error",e,e.stack);
			that.socket.send(JSON.stringify({"key":that.api_key,"result":"error"}), function (data) {
				console.log(data); // data will be 'woot'
			});

		}
		
	});
	}
	
	this.supportedChannels = this.loadChannelHandler();
	
	this.plugin.initialized = true;
	this.log.info("initialization completed %s",this.plugin.initialized);

	this.reconnectTimer = setTimeout(function() {
		that.reconnect()
	} , 1000);
	
}


AlexaPlatform.prototype.shutdown = function() {
	this.log.debug("Alexa Plugin Shutdown");
	this.socket.disconnect();
}

AlexaPlatform.prototype.processAlexaMessage = function(alx_message) {
	var that = this;
	var ap_id = alx_message.payload.appliance.applianceId;
	alexaLogger.info("Alexa Message "+ ap_id + " " +  alx_message.header.name);
	if (ap_id) {
		var ap_obj = that.alexa_appliances[ap_id];
		if (ap_obj) {
			var hms = ap_obj.service;
			if (hms) {
				hms.handleEvent(alx_message,function(responseNameSpace,responseName,response_payload){
				var result = that.generateResponse(responseNameSpace,responseName, response_payload);
					that.socket.send(JSON.stringify({"key":that.api_key,"result":result}), function (data) {});
				});
			}
		} else {
			alexaLogger.info("Appliance " + ap_id + " was not found or is not alaxa enabled");
			that.log.warn("Appliance %s was not found or is not alaxa enabled",ap_id);
		}
	} else {
		that.log.debug("missed appliance id");
	}
}

AlexaPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request);
	var result = [];
	result.push({"control":"text","name":"api_key","label":this.localization.localize("Cloud Api Key"),"value":this.api_key,"size":50});
	result.push({"control":"text",
					"name":"ccu_varname",
				   "label":this.localization.localize("CCU Variable to Enable Alexa (optional)"),
				   "value":this.ccu_varname,
		     "description":this.localization.localize("Please setup as a boolean variable. All alexa events will be ignored if this variable is set to false (0)")
	});
	return result;
}

AlexaPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var api_key = settings.api_key;
	var ccu_varname = settings.ccu_varname;

	if  (ccu_varname) {
		this.ccu_varname = ccu_varname;
		this.configuration.setValueForPlugin(this.name,"ccu_varname",ccu_varname); 
	} else {
		this.ccu_varname = "";
		this.configuration.setValueForPlugin(this.name,"ccu_varname",""); 
	}

	if (api_key) {
		this.api_key = api_key;
		this.configuration.setValueForPlugin(this.name,"api_key",api_key); 
		clearTimeout(this.reconnectTimer);
		this.reconnect();
	}
}

AlexaPlatform.prototype.reconnect = function() {
	var that = this;
	if (this.api_key != undefined) {
		alexaLogger.info("Reconnecting to Cloud Service");
		var last = this.api_key.slice(-4);
		alexaLogger.info("using API-Key : XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXX" + last);
		this.socket.disconnect();
		this.socket.connect(); 
	} else {
		alexaLogger.info("No API Key found. Get one at https://console.ksquare.de/alexa \r\n");
	}
	this.reconnectTimer = setTimeout(function() {
		that.reconnect()
	} , 3600000);
}


AlexaPlatform.prototype.reloadApplicances = function() {
	this.alexa_appliances = {};
	var that = this;
    var p_applicances = this.configuration.loadPersistentObjektfromFile("alexa_objects");
    var objects = p_applicances["alexa"];
    if (objects) {
	    objects.forEach(function (alexa_object) {
			that.log.info("Adding %s to Alexa",alexa_object.name);
	
			if ((alexa_object.type=="AlexaLogicService")||(alexa_object.isVirtual!=undefined)) {
				that.add_virtual_appliance(alexa_object.adress,alexa_object.name,alexa_object.type);
			} else {
				that.add_appliance(alexa_object.adress,alexa_object.name,alexa_object.type);
			}
			
	    });
    } else {
	    this.log.info("There are no objects for alexa");
    }
    
}

AlexaPlatform.prototype.generateResponse = function(nameSpace,cmdname, response_payload) {

  var header = {};
  header["messageId"] = uuid.v1();
  header["namespace"] = nameSpace;
  header["name"] = cmdname;
  header["payloadVersion"] ="2";

  
  var payload = response_payload || {};
  
  return {"header":header,"payload":payload};
}

AlexaPlatform.prototype.get_appliances = function() {
  var result = [];
  var that = this;
  Object.keys(this.alexa_appliances).forEach(function (key) {
	  var ap_obj = that.alexa_appliances[key];
	  result.push(ap_obj.alexa);
  });
  return result;
}


AlexaPlatform.prototype.add_appliance = function(id,name,hmService,virtual) {

  try {
	  var service = require ('./service/' + hmService);
	  var hms = new service(id,this.client,this.log,this.hm_layer);
	  hms.alexaname = name;
	  hms.server = this.server;

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
  this.alexa_appliances[id] = {"alexa":al_ap,"service":hms,"id":id,"name":name,"service_name":hmService,"isVirtual":virtual || false};
  return hms;
  } catch (error) {
	this.log.error("Service %s not found",hmService);
	return undefined;
  }
}


AlexaPlatform.prototype.add_virtual_appliance = function(id,name,hmService) {
	var hms = this.add_appliance(id,name,hmService,true);
	
	if (hms) {
		var hmDevice = new HomematicDevice();
		hmDevice.initWithType("HM-LC-Sw1-Pl", id );
		this.hm_layer.addDevice(hmDevice,false,true); // Hide device from CCU
		hms.virtual_device = hmDevice;
	}
}

AlexaPlatform.prototype.save_appliances = function(callback) {
	var pobj = [];
	var that = this;
	Object.keys(this.alexa_appliances).forEach(function (key) {
	  var applicance = that.alexa_appliances[key];
	  var aobj = {"adress":applicance.id,"name":applicance.name,"type":applicance.service_name};
	  if ((applicance.isVirtual) && (applicance.isVirtual==true)) {
		  aobj["isVirtual"]=true;
	  }
	  pobj.push(aobj);
	});
		  	  
     this.configuration.savePersistentObjektToFile({"alexa":pobj},"alexa_objects",callback);
}


AlexaPlatform.prototype.remove_appliance_withID = function(dispatched_request) {
	var that = this;
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var applicanceId = queryObject["id"];

	var obj = this.alexa_appliances[applicanceId];
	if (obj) {
		this.log.debug("Object to delete was found");
		
	}
	delete this.alexa_appliances[applicanceId];
	this.save_appliances( function (){
		that.reloadApplicances();
	});
}

AlexaPlatform.prototype.loadChannelHandler = function() {
	var buffer = fs.readFileSync(__dirname + '/service/config.json');
    try {
    	var c_object = JSON.parse(buffer.toString());
		var serviceList = [];
		if ((c_object) && (c_object["hm_device_settings"])) {
	 	   return c_object["hm_device_settings"];
		}
	} catch (e) {
		this.log.error(e);
	}
	return [];
}


AlexaPlatform.prototype.serviceList = function() {
	var buffer = fs.readFileSync(__dirname + '/service/config.json');
    try {
    	var c_object = JSON.parse(buffer.toString());
		if ((c_object) && (c_object["handler"])) {
	 	   return c_object["handler"];
		}
	} catch (e) {
		this.log.error(e);
	}
	return [];
}

AlexaPlatform.prototype.generateEditForm = function(dispatched_request) {
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var applicanceId = queryObject["id"];
	var formData = "";
	var appliance_template = dispatched_request.getTemplate(this.plugin.pluginPath , "list_edit.html",null);
	var appliance = this.alexa_appliances[applicanceId];
	var phrases = "";
	appliance.service.getPhrases(dispatched_request.language).forEach(function (phrase){
			phrases = phrases + phrase + "<br />";
	});
	
	var str_service = "";
	
	this.serviceList().forEach(function (service){
		if (service == appliance.service_name) {
			str_service = str_service + "<option selected=selected>"+service+"</option>";	
		} else {
			str_service = str_service + "<option>"+service+"</option>";	
		}
	});
	
	var appdevice = appliance.id;
	if (appliance.id.indexOf("P:"===0)) {
		appdevice = appliance.name;
	}
								
	formData = dispatched_request.fillTemplate(appliance_template,{"appliance.device":appdevice,
																	   "appliance.id":appliance.id,
  														    		 "appliance.name":appliance.name,
  																  "appliance.service":str_service,
  																  "appliance.phrases":phrases});
  																				  
  	return formData;
}

AlexaPlatform.prototype.saveApplicance = function(dispatched_request) {
	
	var requesturl = dispatched_request.request.url;
	var queryObject = url.parse(requesturl,true).query;
	var that = this;
	var applianceID = 	queryObject["appliance.device"]
	var applianceName = queryObject["appliance.name"];
	var service = 		queryObject["appliance.service"];
	
	if ((applianceID) && (applianceName) && (service)) {
		
		var appliance = this.alexa_appliances[applianceID];
		if (appliance) {
			appliance.name = applianceName;
			appliance.service_name = service;
			this.log.debug("Edit Mode");
		} else {
			if (service.type=="AlexaLogicService") {
				this.add_virtual_appliance(applianceID,applianceName,service);
			} else {
				that.add_appliance(applianceID,applianceName,service);
			}
		}
		
		this.save_appliances( function (){
			that.reloadApplicances();
		});
	}
	
}

AlexaPlatform.prototype.channelService = function(channelType) {
	return  this.supportedChannels[channelType];
}

AlexaPlatform.prototype.loadHMDevices = function(callback) {
    var that = this;
    var result_list = {};
    var script = "string sDeviceId;string sChannelId;boolean df = true;Write(\'{\"devices\":[\');foreach(sDeviceId, root.Devices().EnumIDs()){object oDevice = dom.GetObject(sDeviceId);if(oDevice){var oInterface = dom.GetObject(oDevice.Interface());if (oInterface.Name() == 'BidCos-RF') { if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\' # sDeviceId # \'\",\');Write(\'\"if\": \"\' # oInterface # \'\",\');Write(\'\"name\": \"\' # oDevice.Name() # \'\",\');Write(\'\"address\": \"\' # oDevice.Address() # \'\",\');Write(\'\"type\": \"\' # oDevice.HssType() # \'\",\');Write(\'\"channels\": [\');boolean bcf = true;foreach(sChannelId, oDevice.Channels().EnumIDs()){object oChannel = dom.GetObject(sChannelId);if(bcf) {bcf = false;} else {Write(\',\');}Write(\'{\');Write(\'\"cId\": \' # sChannelId # \',\');Write(\'\"name\": \"\' # oChannel.Name() # \'\",\');if(oInterface){Write(\'\"intf\": \"\' # oInterface.Name() 	# \'\",\');Write(\'\"address\": \"\' # oInterface.Name() #\'.'\ # oChannel.Address() # \'\",\');}Write(\'\"type\": \"\' # oChannel.HssType() # \'\"\');Write(\'}\');}Write(\']}\');}}}Write(\']}\');";
    
    new regaRequest(this.server.getBridge(),script,function(result){
	    
	    try {
		    if (result) {
		    var jobj = JSON.parse(result);
		    jobj.devices.forEach(function (device){
			    device.channels.forEach(function (channel){
				   var service = that.channelService(channel.type);
				   if (service) {
					   var address = channel.address;
					   address = address.replace('BidCos-RF.', '');
					result_list[channel.address] = {"device":device.name,"address":address,"name":channel.name,"service":service};   
				   };
			    });
		    });
			}    
	    } catch (e) {
		    console.log(e.stack);
	    }
	    
	    callback(result_list);
    });
}

AlexaPlatform.prototype.loadCCUProgramms = function(callback) {
    var that = this;
    var result_list = {};
    var script = "string pid;boolean df = true;Write(\'{\"programs\":[\');foreach(pid, dom.GetObject(ID_PROGRAMS).EnumUsedIDs()){var prg = dom.GetObject(pid);if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\' # pid # \'\",\"name\": \"\' # prg.Name() # \'\"}\');}Write(\"]}\");\";"
    
    new regaRequest(this.server.getBridge(),script,function(result){
	    
	    try {
		    if (result) {
		    var jobj = JSON.parse(result);
		    jobj.programs.forEach(function (program){
				result_list["P:" + program.id] = {"device":program.name,"address":"P:" + program.id,"name":program.name,"service":"AlexaHomematicProgramService"};   
			});
			}  
	    } catch (e) {
		    console.log(e.stack);
	    }
	    
	    callback(result_list);
    });
}

AlexaPlatform.prototype.loadVirtualDevices = function(callback) {
   var that = this;
   var result_list = {};
   var platform;
   try {
   this.server.configuratedPlugins.forEach(function (plugin) {
	  platform = plugin.platform;
	  if (platform) {
		  if (typeof(platform.myDevices) == 'function') {
		  var devices = platform.myDevices();
		  if (devices) {
		 	devices.forEach(function (device){
			 	var service = that.channelService(device.type);
				result_list[device.id] = {"device":device.name,"address":(service) ? device.id:"","name":device.name,"service":(service)?service:""}; 			  
		  	});
		  }
		 }
	  } 
   });
} catch (e) {
	this.log.error(platform);
	this.log.error(e.stack)
}
   callback(result_list);
}

AlexaPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
	var deviceList = undefined;
	var that = this;
	var template = "index.html";
	
	var requesturl = dispatched_request.request.url;
	
	var queryObject = url.parse(requesturl,true).query;

	if (queryObject["do"]!=undefined) {
		
		switch (queryObject["do"]) {
			
			
			case "appliance.delete": 
			{
				this.remove_appliance_withID(dispatched_request);
			}
			break;
			
			case "appliance.edit": 
			{
				template = "edit.html";
				deviceList = this.generateEditForm(dispatched_request);
			}
			break;
			
			case "appliance.save":
			{
				this.log.debug("Saving ");
				this.saveApplicance(dispatched_request);
			}
			break;
			
			case "appliance.new":
			{
				template = "new_appliance.html";
				deviceList = "";
			}
			break;
			
			case "device.list":
			{
				this.loadHMDevices(function (result){
				   dispatched_request.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify(result)});
				});
				return;
			}
			break;

			case "device.listvirtual":
			{
				this.loadVirtualDevices(function (result){
				   dispatched_request.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify(result)});
				});
				return;
			}
			break;

			case "device.listprograms":
			{
				this.loadCCUProgramms(function (result){
				   dispatched_request.dispatchFile(that.plugin.pluginPath , "list.json" ,{"list":JSON.stringify(result)});
				});
				return;
			}
			break;

			
			case "phrase.list":
			{
				var hmService = queryObject["service"];
				var name = queryObject["name"];
				var phrases = "";
				
				if (this.serviceList().indexOf(hmService)>-1) {
					var service = require ('./service/' + hmService);
					var hms = new service("",this.client,this.log,this.hm_layer);
					hms.alexaname = name;
				
					hms.getPhrases(dispatched_request.language).forEach(function (phrase){
						phrases = phrases + phrase + "<br />";
					});
				}
				dispatched_request.dispatchFile(this.plugin.pluginPath , "list.html" ,{"list":phrases});
				
				return;
			}
			break;
			
			case "app.js":
			{
				template="app.js";
			}
			break;
			
			case "showlog": {
				
				var options = {
					start:  0,
					rows: 9999999,
					order:  'desc',
					fields: ['message','label','level','timestamp']
				};
				
				alexaLogger.query(options, function (err, result) {
					var str = "";
					result.dailyRotateFile.some(function (msg){
						if (msg.label==="AlexaEvent") {
							str = str + msg.timestamp  + "  [" + msg.level + "] - " + msg.message + "\n";
						}
					})
	 				dispatched_request.dispatchFile(that.plugin.pluginPath , "log.html" ,{"logData":str});
 			  	});

			  return;		  
			}
			
			break;


			
		}
	}
	
	if (deviceList==undefined) {
		deviceList="";
		var appliance_template = dispatched_request.getTemplate(this.plugin.pluginPath , "list_appliance.html",null);

		Object.keys(this.alexa_appliances).forEach(function (key) {
		var appliance = that.alexa_appliances[key];
		var appdevice = appliance.id;
		if (appliance.id.indexOf("P:"===0)) {
			appdevice = appliance.name;
		}
		deviceList = deviceList + dispatched_request.fillTemplate(appliance_template,{"appliance.id":appliance.id,
																				  "appliance.device":appdevice,
  																			   	    "appliance.name":appliance.name,
																			     "appliance.service":appliance.service_name});
		});

	}

	dispatched_request.dispatchFile(this.plugin.pluginPath , template ,{"listDevices":deviceList});

}

module.exports = AlexaPlatform;
