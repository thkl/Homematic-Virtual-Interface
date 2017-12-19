//
//  Util.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 19.02.17
//  Copyright © 2016 kSquare.de. All rights reserved.
//
//  Some Utilities


"use strict";

var url = require('url');
var qs = require('qs');
var fs = require('fs');


function httpCall(method,aUrl,parameter,callback) {
  try {
  	var myURL = url.parse(aUrl);
  	var that = this;
  	var options = {
		  host: myURL.hostname,
		  path: myURL.pathname,
		  method: method,
  	};
  	
  	var mqs = ''
  	if (parameter) {
	  	mqs = qs.stringify(parameter);
  	  	if ((method != "POST") && (mqs.length > 0)) {
	  		options.path = options.path + "?" + mqs  
  		}
  	} 
  	var http;
  	switch (myURL.protocol) {
	  case "http:":
	  	http = require('http')
	  	options.port = 80
	  	break;
	  case "https:":
	  	options.port = 443
	  	http = require('https')
	  	break;
  	}
  
  	if (http) {
		var req = http.request(options, function(res) {
			var data = "";
			res.setEncoding("binary");
			res.on("data", function(chunk) {
        		data += chunk.toString();
			});
			res.on("end", function() {
    		 	if (callback) {callback(data,null);}
			});
			req.on("error", function(e) {
        		callback(undefined,e);
			});
			req.on("timeout", function(e) {
        		callback(undefined,e);
			});
 		});
 		req.setTimeout(30000);
 		if (method=="POST") {
 			req.write(mqs);
  		}
  	req.end();
  	} else {
	  if (callback) {
		  callback(null,new Error('Unknow Protocol'))
	  }
  	}
  } catch (error) {
	  callback(null,error)
  }
}

function httpDownload(method,aUrl,parameter,saveTo,callback) {
  try {
  	var myURL = url.parse(aUrl);
  	var that = this;
  	var options = {
		  host: myURL.hostname,
		  port: 80,
		  path: myURL.pathname,
		  method: method,
  	};
  	
  	var mqs = ''
  	if (parameter) {
	  	mqs = qs.stringify(parameter);
  	  	if ((method != "POST") && (mqs.length > 0)) {
	  		options.path = options.path + "?" + mqs  
  		}
  	} 
  	var http;
  	switch (myURL.protocol) {
	  case "http:":
	  	http = require('http')
	  	break;
	  case "https:":
	  	http = require('https')
	  	options.port = 443
	  	break;
  	}
  
  	if (http) {
	  	var req = http.request(options, function(res) {
			var data = "";
			res.setEncoding("binary");
			res.on("data", function(chunk) {
        		data += chunk;
			});
			res.on("end", function() {
				fs.writeFile(saveTo , data, 'binary', function (err) {
    		 		if (callback) {callback(saveTo,null);}
            	});
				
			});
			req.on("error", function(e) {
        		callback(undefined,e);
			});
			req.on("timeout", function(e) {
        		callback(undefined,e);
			});
 		});
 		req.setTimeout(30000);
 		if (method=="POST") {
 			req.write(mqs);
  		}
  	req.end();
  	} else {
	  if (callback) {
		  callback(null,new Error('Unknow Protocol'))
	  }
  	}
  } catch (error) {
	  callback(null,error)
  }
}



function createPathIfNotExists(pathname) {
	var fs = require('fs')
	if (!fs.existsSync(pathname)){
    	fs.mkdirSync(pathname);
	}
}

module.exports = {
	httpCall:httpCall,
	createPathIfNotExists:createPathIfNotExists,
	httpDownload:httpDownload
}