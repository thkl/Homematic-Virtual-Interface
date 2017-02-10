"use strict";
//
//  HomematicReqaRequest.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 15.01.17.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
 
var http = require("http");
var logger = require(__dirname + "/logger.js").logger("RegaRequest");

var HomematicReqaRequest = function(bridge,script,callback) {
	
	  var ccuIP =  bridge.ccuIP;
	  var that = this;
	  var post_options = {
      host: ccuIP,
      port: "8181",
      path: "/tclrega.exe",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": script.length
      	}
      };

    var post_req = http.request(post_options, function(res) {
      var data = "";
      
      res.setEncoding("binary");
      
      res.on("data", function(chunk) {
        data += chunk.toString();
      });
      
      res.on("end", function() {
        var pos = data.lastIndexOf("<xml><exec>");
        var response = (data.substring(0, pos));
        //logger.debug("Rega Response %s",response);
        callback(response);
      });

      
    });


    post_req.on("error", function(e) {
	    logger.warn("Error %s while executing rega script %s" ,e, script);
        callback(undefined);
    });

    post_req.on("timeout", function(e) {
	    logger.warn("timeout from %s while executing rega script %s",bridge.ccuIP,script);
        callback(undefined);
    });
    
	post_req.setTimeout(10000);
	//logger.debug("RegaScript %s",script);
    post_req.write(script);
    post_req.end();
	
}

module.exports = HomematicReqaRequest;

