'use strict'

//
//  BMWConnectedDrive.js
//  BMWConnectedDrive
//
//  Created by Thomas Kluge on 01.10.2017.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
let url = require("url");
let http = require('https');
let querystring = require('querystring');


var BMWConnectedDrive = function (username,password,auth,logger) {
	this.username = username
	this.password = password
	this.auth = auth
	this.logger = logger
}


BMWConnectedDrive.prototype.login = function(callback) {
  var post_data = querystring.stringify({
      'grant_type' : 'password',
      'username': this.username,
      'scope': 'vehicle_data',
      'password' : this.password
  });
 
 let path = '/webapi/oauth/token/'
 var that = this
 
 if (callback) {
 	this.post_request(path,post_data,function(tokendata){
	 	var t = JSON.parse(tokendata);
	 	that.token = t['access_token']
	 	callback(t['access_token'])
 	})
 } else {
	 this.logger.error('missing callback')
 }
}


BMWConnectedDrive.prototype.getVehicleData = function(vin,callback) {
 
 let path = '/webapi/v1/user/vehicles/' + vin + '/status'
 var that = this
 if (callback) {
 	this.get_request(path,function(result){
	 	callback(JSON.parse(result))
 	})
 } else {
	 this.logger.error('missing callback')
 }


}


BMWConnectedDrive.prototype.get_request = function(path,callback) {

  var that = this;
  if (this.token != undefined) {
  // An object of options to indicate where to post to
  var options = {
      host: 'b2vapi.bmwgroup.com',
      port: '443',
      path: path,
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + this.token,
          'User-Agent':'MCVApp/1.5.2 (iPhone; iOS 9.1; Scale/2.00)'
     }
  };
  
  var post_req = http.request(options, function(res) {
      var data = "";
      
      res.setEncoding('utf8');
      
      
      res.on("data", function(chunk) {
        data += chunk.toString();
      });
      
      res.on("end", function() {
        if (callback) {callback(data);}
      });

      
   });


    post_req.on("error", function(e) {
	    that.logger.warn("Error %s while executing" ,e);
        if (callback) {callback(undefined);}
    });

    post_req.on("timeout", function(e) {
	    that.logger.warn("timeout from while executing");
        if (callback) {callback(undefined);}
    });
    
	post_req.setTimeout(5000);
    post_req.end();	
  } else {
	  this.logger.error("Missing token .. please do a login first")
  }
}


BMWConnectedDrive.prototype.post_request = function(path,post_data,callback) {

  var that = this;
  // An object of options to indicate where to post to
  var post_options = {
      host: 'b2vapi.bmwgroup.com',
      port: '443',
      path: path,
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(post_data),
          'Authorization': 'Basic ' + this.auth,
          'User-Agent':'MCVApp/1.5.2 (iPhone; iOS 9.1; Scale/2.00)'
      }
  };
  
  var post_req = http.request(post_options, function(res) {
      var data = "";
      
      res.setEncoding('utf8');
      
      
      res.on("data", function(chunk) {
        data += chunk.toString();
      });
      
      res.on("end", function() {
        if (callback) {callback(data);}
      });

      
   });


    post_req.on("error", function(e) {
	    that.logger.warn("Error %s while executing" ,e);
        if (callback) {callback(undefined);}
    });

    post_req.on("timeout", function(e) {
	    that.logger.warn("timeout from while executing");
        if (callback) {callback(undefined);}
    });
    
	post_req.setTimeout(4000);
    post_req.write(post_data);
    post_req.end();	
}


module.exports = {
  BMWConnectedDrive : BMWConnectedDrive
}
