'use strict'

//
//  BMWConnectedDrive.js
//  BMWConnectedDrive
//
//  Created by Thomas Kluge on 15.02.2019.
//  Copyright © 2019 kSquare.de. All rights reserved.
//
const URL = require('url').URL;
let http = require('https');
let querystring = require('querystring');


var Vehicle = function() {}


var BMWConnectedDrive = function (username,password,logger) {
	this.username = username
	this.password = password
	this.logger = logger
	this.vehicles = []
}


BMWConnectedDrive.prototype.login = function(callback) {
	
  let url = "https://customer.bmwgroup.com/gcdm/oauth/authenticate"
	
  var post_data = querystring.stringify({
      'state' : 'eyJtYXJrZXQiOiJkZSIsImxhbmd1YWdlIjoiZGUiLCJkZXN0aW5hdGlvbiI6ImxhbmRpbmdQYWdlIn0',
      'username': this.username,
      'client_id': 'dbf0a542-ebd1-4ff0-a9a7-55172fbfce35',
      'password' : this.password,
      'redirect_uri' : 'https://www.bmw-connecteddrive.com/app/default/static/external-dispatch.html',
      'response_type' : 'token',
      'scope':'authenticate_user fupo',
      'locale':'DE-de'
  });
 
 var that = this
 
 if (callback) {
	this.logger.debug('Connected Drive login')
 	this.post_request(url,post_data,function(body,header){
	 	if (header.location) {
		 	let match = header.location.match(/&access_token=([a-zA-z0-9]{0,})/)
		 	let token = match[1]
		 	that.token = token
		 	that.logger.debug('login done access_token saved')
		 	callback(token)
	 	}
 	})
 } else {
	 this.logger.error('missing callback')
 }
}


BMWConnectedDrive.prototype.getVehicles = function(callback) {
	this.vehicles = []
	let that = this
	
	this.logger.debug('Connected Drive Fetch all vehicles')
	let path = 'https://www.bmw-connecteddrive.de/api/me/vehicles/v2?all=true&brand=BM'
	if (callback) {
 		this.get_request(path,function(result){
	 		
	 		if (result !== undefined) {
		 		let objResult = JSON.parse(result)
		 		objResult.map(function (objVehicle){
			 		// Only save bmw i vehicles ... we do not want the clunky old combustion stuff ;)
			 		if (objVehicle['brand'] === 'BMWi') {
				 		let vehicle = new Vehicle()
				 		vehicle.type = objVehicle['basicType']
				 		vehicle.vin = objVehicle['vin']
				 		vehicle.licensePlate = objVehicle['licensePlate']
				 		that.vehicles.push(vehicle)
			 		} else {
				 		that.logger.debug('%s is not an BEV',objVehicle.brand)
			 		}
		 		})
	 		}	
	 		that.logger.debug('%s vehicles found',that.vehicles.length)
	 		callback(that.vehicles)
		})
	} else {
	 this.logger.error('missing callback')
 	}
}




BMWConnectedDrive.prototype.getVehicleData = function(vehicle,callback) {
 
 if (callback) {
	var that = this
	let vin = vehicle.vin
	let path = 'https://www.bmw-connecteddrive.de/api/vehicle/dynamic/v1/'+vin+'?offset=-60'
	if (vin) {
	  	this.get_request(path,function(result){
		  	if (result !== undefined) {
		 		let objResult = JSON.parse(result)
		 		vehicle.battery = objResult['attributesMap']['chargingLevelHv']	
		 		vehicle.range = objResult['attributesMap']['beRemainingRangeElectricKm']
		 	}	
	 		callback(vehicle)
	 	})
	}
	else {
		callback(undefined)
	}
 } else {
	 this.logger.error('missing callback')
 }


}


BMWConnectedDrive.prototype.get_request = function(callurl,callback) {

  var that = this;
  if (this.token != undefined) {
  // An object of options to indicate where to post to
  const myURL = new URL(callurl);
  var options = {
      host: myURL.hostname,
      port: '443',
      path: myURL.pathname,
      method: 'GET',
      headers: {
          'Authorization': 'Bearer ' + this.token,
          'Accept': 'application/json, text/plain, */*',
          'Connection':'Close',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15'
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


BMWConnectedDrive.prototype.post_request = function(callurl,post_data,callback) {

  var that = this;
  const myURL = new URL(callurl);
  
  // An object of options to indicate where to post to
  var post_options = {
      host: myURL.hostname,
      port: '443',
      path: myURL.pathname,
      method: 'POST',
      headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
          'Content-Length': Buffer.byteLength(post_data),
          'Connection':'Close',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.2 Safari/605.1.15'
      }
  };

  var post_req = http.request(post_options, function(res) {
      var data = "";
      
      res.setEncoding('utf8');
      
      
      res.on("data", function(chunk) {
        data += chunk.toString();
      });
      
      res.on("end", function() {
        if (callback) {callback(data,res.headers)}
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
  BMWConnectedDrive : BMWConnectedDrive,
  Vehicle : Vehicle
}
