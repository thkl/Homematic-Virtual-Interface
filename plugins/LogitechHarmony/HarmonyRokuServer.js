
//
//  HarmonyRokuServer.js
//  Homematic Virtual Interface Plugin
//
// with help from https://github.com/Pmant/ioBroker.fakeroku
//


"use strict";
var HomematicDevice;
var path = require('path');
var DispatchedRequest = require(__dirname + '/DispatchedRequest.js').DispatchedRequest;
var FakeHueDevice = require(__dirname + '/FakeHueDevice.js').FakeHueDevice;
var CCUDevice = require(__dirname + '/CCUDevice.js').CCUDevice;
var RealHueDevice = require(__dirname + '/RealHueDevice.js').RealHueDevice;
var appRoot = path.dirname(require.main.filename);
var fs = require("fs");

if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}
if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);


var http = require('http');
var http = require('http');
var httpHeaders = require('http-headers');
var uuid = require('uuid');

var MULTICAST_IP;
var BIND;


var HarmonyRokuServer = function (plugin,port,instance) {

	this.name = plugin.name
	this.plugin = plugin
	this.log = this.plugin.log
    this.log.debug("FakeRoku init")
	this.server = this.plugin.server
	this.config = this.server.configuration
	this.bridge = this.server.getBridge();
	this.rokuInstance = instance || ""
    this.multicast_ip = "239.255.255.250";
    this.bind = this.bridge.getLocalIpAdress();

    this.uuid = uuid.v1();
    this.http_port = port || 9093;
    this.ssdp_response = "HTTP/1.1 200 OK\r\nCache-Control: max-age=300\r\nST: roku:ecp\r\nUSN: uuid:roku:ecp:" +
            this.uuid + "\r\nExt: \r\nServer: Roku UPnP/1.0 MiniUPnPd/1.4\r\nLOCATION: http://" +
            this.bind + ":" + this.http_port + "/\r\n\r\n"

    
    this.descxml = '<?xml version="1.0" encoding="UTF-8" ?><root xmlns="urn:schemas-upnp-org:device-1-0"><specVersion><major>1</major>'
    this.descxml = this.descxml + '<minor>0</minor></specVersion>'
    this.descxml = this.descxml + '<device><deviceType>urn:roku-com:device:player:1-0</deviceType>'
    this.descxml = this.descxml + '<friendlyName>Homematic-Harmony'+ this.rokuInstance + '</friendlyName><manufacturer>thkl</manufacturer>'
    this.descxml = this.descxml + '<manufacturerURL>https://github.com/thkl/</manufacturerURL><modelDescription>HVL Fake Roku </modelDescription>'
    this.descxml = this.descxml + '<modelName>Homematic-Harmony'+ this.rokuInstance + '</modelName><modelNumber>4200X</modelNumber>'
    this.descxml = this.descxml + '<modelURL>https://github.com/thkl/Homematic-Virtual-Interface</modelURL>'
    this.descxml = this.descxml + '<serialNumber>'+ this.uuid + '</serialNumber><UDN>uuid:roku:ecp:'+ this.uuid + '</UDN>'
    this.descxml = this.descxml + '<software-version>7.5.0</software-version><software-build>09021</software-build><power-mode>PowerOn</power-mode>'
    this.descxml = this.descxml + '<serviceList><service>'
    this.descxml = this.descxml + '<serviceType>urn:roku-com:service:ecp:1</serviceType>'
    this.descxml = this.descxml + '<serviceId>urn:roku-com:serviceId:ecp1-0</serviceId>'
    this.descxml = this.descxml + '<controlURL/><eventSubURL/><SCPDURL>ecp_SCPD.xml</SCPDURL></service>'
    this.descxml = this.descxml + '</serviceList></device></root>';
        
        
    this.apsxml = `<apps>
  <app id="11">Roku Channel Store</app>
  <app id="12">Netflix</app>
  <app id="13">Amazon Video on Demand</app>
  <app id="14">MLB.TV¨</app>
  <app id="26">Free FrameChannel Service</app>
  <app id="27">Mediafly</app>
  <app id="28">Pandora</app>
  </apps>`;
  
  
   this.mapping = {"Rev":1,"Fwd":2,"Play":3,"Back":4,"Home":5,"Info":6,"Up":7,"Down":8,"Right":9,"Left":10,"Select":11,"InstantReplay":12,"Search":13}
}

HarmonyRokuServer.prototype.init = function() {
  	
  	HomematicDevice = this.bridge.homematicDevice;
	this.hmDevice = new HomematicDevice(this.plugin.getName());
	
	
	var data = this.bridge.deviceDataWithSerial("HarmonyRoku"+this.rokuInstance);
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
	} 
	
	if (this.hmDevice.initialized == false) {
		this.hmDevice.initWithType("HM-RC-19", "HarmonyRoku"+this.rokuInstance);
		this.bridge.addDevice(this.hmDevice,true);
	} else {
		this.bridge.addDevice(this.hmDevice,false);
	}
    this.startServer()
}

       
HarmonyRokuServer.prototype.stopServer = function() {
    this.rk_server.close();
}


HarmonyRokuServer.prototype.parseCommand = function(command) {
	try { 
	var cmdarray;
    if (cmdarray = command.match(/^\/([^\/]+)\/(\S+)$/)) {
     if (cmdarray[1] == "keypress") {
        var cmd = cmdarray[2].replace(".", "_")
        this.log.debug("Roku Press Key: " + cmdarray[2])
        var snum = this.mapping[cmdarray[2]];
        if (snum) {
	        var channel = this.hmDevice.getChannelWithTypeAndIndex("KEY",snum); 
			if (channel) {
	        	channel.setValue("PRESS_SHORT",true);
				channel.updateValue("PRESS_SHORT",true,true,true)
        	}
		}
     } else {
	     this.log.debug(cmdarray[1])
     }
    }
    } catch (e) {
	    this.log.error(e);
    }
}

HarmonyRokuServer.prototype.startServer = function(callback) {
    var that = this
    this.log.debug("FakeRoku start Server")

    this.rk_server = http.createServer(function (request, response) {
       
       request.connection.ref();
       var method = request.method;
        var url = request.url;
        var body = [];
        request.on('error', function (err) {
            that.log.warn(err);
        }).on('data', function (chunk) {
            body.push(chunk);
        }).on('end', function () {
        
        response.on('error', function (err) {
                that.log.warn(err);
        });
        
        if (method === 'GET' && url == '/') {
                response.statusCode = 200;
                response.setHeader('Content-Type', 'text/xml; charset=utf-8');
                response.setHeader('Connection', 'close');
                response.end(that.descxml, function () {
                    request.connection.unref();
                });
        } else {
        
        if (method === "GET") {
                    var message = that.parseQuery(url);
                    response.statusCode = 200;
                    response.setHeader('Content-Type', 'text/xml; charset=utf-8');
                    response.setHeader('Connection', 'close');
                    that.log.debug("responding to get request");
                    response.end(message, function () {
                        request.connection.unref();
                    });
        } else {
	                that.log.debug("trying to parse command");
                    that.parseCommand(url);
                    response.end(function () {
                        request.connection.unref();
                    });
                }
        }
        
        });
    });
    
    this.rk_server.on('connection', function (socket) {
       // socket.unref();
    });
    
    this.rk_server.on("error", function (err) {
        that.log.error(err);
        that.stopServer();
    });

    this.rk_server.listen(this.http_port, this.bind, function () {
        that.log.debug("HTTP-Server started on " + that.bind + ":" + that.http_port);
    });
    if (typeof callback === 'function') callback();
}

HarmonyRokuServer.prototype.getMapping = function () {
 return this.mapping
}


HarmonyRokuServer.prototype.parseQuery = function (query) {
    var message = "";
    switch (query) {
        case "/query/apps":
            message = this.apsxml;
            break;
        case "/query/device-info":
            message = this.descxml;
            break;

        default:
            break;
    }
    return message;
}

module.exports = {
  HarmonyRokuServer : HarmonyRokuServer
}