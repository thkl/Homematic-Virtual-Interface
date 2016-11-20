"use strict";

var HueApi = require("node-hue-api").HueApi;
var HueDevice = require(__dirname + "/HueDevice.js").HueDevice;
var debug = require('debug')('Hue Bridge');
const chalk = require('chalk');
const log = console.log;

var HueBridge = function() {
	
	this.mappedDevices = [];
	this.hue_ipAdress;
	this.hue_userName;
	this.hue_api;
	this.hm_layer;
	this.configuration;
}


HueBridge.prototype.init = function(configuration,hmlayer) {
	var that = this;
	this.configuration = configuration;
	
	
	if ((this.configuration.getValue("hue_bridge_ip")!=undefined) && (this.configuration.getValue("hue_bridge_ip")!="")) {
    this.hue_ipAdress = this.configuration.getValue("hue_bridge_ip");
    
	log(chalk.gray("Hue Bridge Init at " + this.hue_ipAdress));

	if (this.checkUsername()==true) {
	    this.queryBridgeAndMapDevices()
    }

} else {
	
	this.locateBridge( function (err, ip_address) {
        if (err) throw err;
		if (ip_address != undefined) {
        that.hue_ipAdress = ip_address;
        that.configuration.setValue("hue_bridge_ip",that.hue_ipAdress); 
        log(chalk.gray("Saved the Philips Hue bridge ip address "+ that.hue_ipAdress +" to your config to skip discovery."));

        if (that.checkUsername()==true) {
	        that.queryBridgeAndMapDevices()
        }
		} else {
	        log(chalk.red("No bridges this did not make sense .. giving up"));
	        process.exit();
		}

     });
}
  this.hm_layer = hmlayer;
}


HueBridge.prototype.locateBridge = function (callback) {

	log(chalk.gray("trying to find your Hue bridge ..."));
	var hue = require("node-hue-api");
	
	hue.upnpSearch(6000).then(function (bridges) {
		if ((bridges != undefined) && (bridges.length > 0)) {
		  log(chalk.gray("Scan complete",bridges[0].ipaddress));
          hue_ipAdress = bridges[0].ipaddress;
          callback(null,undefined);
		} else {
          log(chalk.gray("Scan complete but no bridges found"));
          callback(null,null);
		}
    }).done();
    
}


HueBridge.prototype.checkUsername = function() {
   var that = this;
   if ((this.configuration.getValue("hue_username")==undefined) || (this.configuration.getValue("hue_username")=="")) {
       log(chalk.gray("trying to create a new user at your bridge"));
	   var api = new HueApi(that.hue_ipAdress);
        api.createUser(that.hue_ipAdress,function(err, user) {
          // try and help explain this particular error
          
          if (err && err.message == "link button not pressed") {
            log(chalk.red("Please press the link button on your Philips Hue bridge within 30 seconds."));
            setTimeout(function() {checkUsername();}, 30000);
          } else {
	        that.configuration.setValue("hue_username",user); 
            log(chalk.gray("saved your user to config.json"));
            that.hue_userName = user;
            return true;
          }
        });
   } else {
     that.hue_userName = that.configuration.getValue("hue_username");
	 return true;   
   }
}


// Make a connection to the HUE Bridge... if there are no credentials .. try to find a bridge

	
HueBridge.prototype.queryBridgeAndMapDevices = function() {

this.hue_api = new HueApi(this.hue_ipAdress,this.hue_userName);

// --------------------------
// Fetch Lights
this.queryLights();
// Fetch the Groups
this.queryGroups();

}


HueBridge.prototype.queryLights = function() {
	var that = this;
	this.hue_api.lights(function(err, lights) {
	
	if ((lights != undefined) && (lights["lights"]!=undefined)) {
  		lights["lights"].forEach(function (light) {
    		debug("Adding new Light " + light["name"] + " to " + that.hm_layer.ccuIP);
    		var hd = new HueDevice(that.hm_layer,that.hue_api,light,"HUE0000");
    		that.mappedDevices.push(hd);
  		});
  		}
  	log(chalk.green("Lightinit completed with " + lights.length + " devices mapped."));
  
	});
}


HueBridge.prototype.queryGroups = function() {
	var that = this;
	this.hue_api.groups(function(err, groups) {
	
	if (groups != undefined) {
		var id = 1;
		groups.forEach(function (group) {
    		debug("Adding new Group " + group["name"]+ " to " + that.hm_layer.ccuIP);
    		group["id"] = id;
    		that.mappedDevices.push(new HueDevice(that.hm_layer,that.hue_api,group,"HUEGROUP00"));
    		id = id +1;
  		});
  	}  
  	log(chalk.green("Groupinit completed with "+ groups.length +" devices mapped."));
	});
}


module.exports = {
  HueBridge : HueBridge
}
