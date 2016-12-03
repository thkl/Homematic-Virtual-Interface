"use strict";

//
//  ConfigurationServer.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var http = require('http');
var fs = require('fs');
var path = require('path');
const EventEmitter = require('events');
const util = require('util');
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("Homematic Virtual Interface.ConfigurationServer");

var contentTypesByExtension = {
    '.html': "text/html",
    '.css':  "text/css",
    '.js':   "text/javascript",
    '.jpg': "image/jpeg",
    '.png': "image/png",
    
  };


var ConfigurationServer = function (config) {
 this.config = config;
 this.port = config.getValueWithDefault("web_http_port",8182);
 this.init();
 EventEmitter.call(this);
}

util.inherits(ConfigurationServer, EventEmitter);

ConfigurationServer.prototype.init = function() {
  var that = this;
  
  logger.debug("Configuration Server Initializing on Port %s", this.port);

  function handleRequest(request, response){
	  
	  var dispatched_request = new DispatchedRequest(request,response);
	  that.emit('config_server_http_event', dispatched_request);
	    
    };
  

//Create a server
 this.server = http.createServer(handleRequest);
 
 this.server.listen(this.port, function(){
   logger.info("Configuration Server is listening on: Port %s",that.port);
 });

};


ConfigurationServer.prototype.shutdown = function() {
	logger.info("Configuration Server Shutdown");
	this.server.close();
}


var DispatchedRequest = function (request,response) {
	
	this.request = request;
	this.response = response;
	
}

// do it syncronous
DispatchedRequest.prototype.getTemplate = function(filepath,file,replacements) {
	var that = this;
	var filename;
	
	if ((filepath == null) || (filepath == undefined)) {
		filepath = path.join(__dirname,"..");
	} 
	
	filename = path.join(filepath, "www") + "/" + file;
	
    try {
	    fs.accessSync(filename, fs.F_OK);
		if (fs.statSync(filename).isDirectory()) filename += '/index.html';
		var file = fs.readFileSync(filename, "binary");
		
	  	var contentType = contentTypesByExtension[path.extname(filename)];
	  		if ((contentType == "text/html") && (replacements != undefined)){
		  			
		  			 

		  		var keys = Object.keys(replacements);
		  		file = file.toString('utf8');
		  		keys.forEach(function(key){
			  		file = file.replace("$"+key+"$",replacements[key]);
		  		});
		  		
	  		}
	  		return file;
	} catch (e) {
	    logger.debug("File %s not found.",filename);
	    return " Template not found";
	}
}

DispatchedRequest.prototype.fillTemplate = function(template,replacements) {
	var keys = Object.keys(replacements);
	template = template.toString('utf8');
	keys.map(function(key){
		template = template.split("$"+key+"$").join(replacements[key]);
	});
	return template;
}

DispatchedRequest.prototype.dispatchFile = function(filepath,file,replacements) {
	var that = this;

	var filename;
	if ((filepath == null) || (filepath == undefined)) {
		filepath = path.join(__dirname,"..");
	} 
	
	filename = path.join(filepath, "www") + "/" + file;
		
    try {
    fs.exists(filename, function(exists) {
   
			if(!exists) {
				that.response.writeHead(404, {"Content-Type": "text/plain"});
				that.response.write("404 Not Found\n");
				that.response.end();
				return;
    		}

		if (fs.statSync(filename).isDirectory()) filename += '/index.html';

		fs.readFile(filename, "binary", function(err, file) {
		
		if(err) {        
       		 that.response.writeHead(500, {"Content-Type": "text/plain"});
	   		 that.response.write(err + "\n");
	   		 that.response.end();
	   		 return;
      	}

	  	var headers = {};
	  	var contentType = contentTypesByExtension[path.extname(filename)];
	  		if (contentType) headers["Content-Type"] = contentType;
	  		
	  		if ((contentType == "text/html") && (replacements != undefined)){
		  		
		  		var keys = Object.keys(replacements);
		  		file = file.toString('utf8');
		  		keys.map(function(key){
			  		file = file.replace("$"+key+"$",replacements[key]);
		  		});
		  		
	  		}
	  	try {
	  		that.response.writeHead(200, headers);
	  		if (!that.response.finished) {
		  		that.response.write(file, "binary");
	  		}
	  		that.response.end();
	  	}	catch (e1){
		  	
	  	}
    	});
  	
    });
    	
    } catch (e) {
	    logger.debug("File %s not found.",filename);
	    that.response.writeHead(500, {"Content-Type": "text/plain"});
	   	that.response.write(e + "\n");
	   	that.response.end();
	}

}


DispatchedRequest.prototype.dispatchMessage = function(message) {
	this.response.writeHead(200, {
			'Content-Length': Buffer.byteLength(message),
			'Content-Type': 'text/html' });
	this.response.end(message);
}



module.exports = {
  ConfigurationServer : ConfigurationServer,
  DispatchedRequest : DispatchedRequest
  
}
