"use strict";

var HomematicLogicalLayer = require(__dirname + "/LogicLayer.js").HomematicLogicalLayer;
var HueApi = require("node-hue-api").HueApi;
var HueDevice = require(__dirname + "/HueDevice.js").HueDevice;
var debug = require('debug')('HM Hue Bridge');
var Config = require(__dirname + '/settings.js').Config;
var ConfigServer = require(__dirname + '/ConfigurationServer.js').ConfigurationServer;
const chalk = require('chalk');
const log = console.log;



log(chalk.gray("Homematic Hue Bridge"));
log(chalk.gray("2016 by thkl https://github.com/thkl/Homematic-Hue-Interface"));
log(chalk.gray("============================================================"));

var configuration = new Config();
var configServer = new ConfigServer();

var mappedDevices = [];
var hue_ipAdress;
var hue_userName;
var hue_api;
var max = 3;

var locateBridge = function (callback) {

	log(chalk.gray("trying to find your Hue bridge ..."));
	var hue = require("node-hue-api");
	
	hue.upnpSearch(6000).then(function (bridges) {
          log(chalk.gray("Scan complete",bridges[0].ipaddress));
          hue_ipAdress = bridges[0].ipaddress;
          callback(null,hue_ipAdress);
    }).done();
    
}


function checkUsername() {
   var that = this;
   if ((configuration.getValue("hue_username")==undefined) || (configuration.getValue("hue_username")=="")) {
       log(chalk.gray("trying to create a new user at your bridge"));
	   var api = new HueApi(hue_ipAdress);
        api.createUser(hue_ipAdress,function(err, user) {
          // try and help explain this particular error
          
          if (err && err.message == "link button not pressed") {
            log(chalk.red("Please press the link button on your Philips Hue bridge within 30 seconds."));
            setTimeout(function() {checkUsername();}, 30000);
          } else {
	        configuration.setValue("hue_username",user); 
            log(chalk.gray("saved your user to config.json"));
            hue_userName = user;
            return true;
          }
        });
   } else {
     hue_userName = configuration.settings["hue_username"];
	 return true;   
   }
}


// Make a connection to the HUE Bridge... if there are no credentials .. try to find a bridge

if ((configuration.getValue("hue_bridge_ip")!=undefined) && (configuration.getValue("hue_bridge_ip")!="")) {
    hue_ipAdress = configuration.settings["hue_bridge_ip"]
	log(chalk.gray("Hue Bridge Init at " + hue_ipAdress));

	if (checkUsername()==true) {
	        initialize_interface()
    }

} else {
	
	locateBridge.call(this, function (err, ip_address) {
        if (err) throw err;

        // TODO: Find a way to persist this
        hue_ipAdress = ip_address;
        configuration.setValue("hue_bridge_ip",hue_ipAdress); 
        log(chalk.gray("Saved the Philips Hue bridge ip address "+ hue_ipAdress +" to your config to skip discovery."));

        if (checkUsername()==true) {
	        initialize_interface()
        }

     });
}
	
function initialize_interface() {

hue_api = new HueApi(hue_ipAdress,hue_userName);

var hm_layer = new HomematicLogicalLayer(configuration);
// --------------------------
// Fetch Lights
hue_api.lights(function(err, lights) {

  if ((lights != undefined) && (lights["lights"]!=undefined)) {
  	lights["lights"].forEach(function (light) {
    		debug("Adding new Light " + light["name"]);
    		mappedDevices.push(new HueDevice(hm_layer,hue_api,light,"HUE0000"));
  });
  }  
  
 
});

// Fetch the Groups

hue_api.groups(function(err, groups) {
	
  if (groups != undefined) {
	var id = 1;
  	groups.forEach(function (group) {
    		debug("Adding new Group " + group["name"]);
    		group["id"] = id;
    		mappedDevices.push(new HueDevice(hm_layer,hue_api,group,"HUEGROUP00"));
    		id = id +1;
  });
  }  
});

configServer.on("config_server_http_event",function(command){
  var url = command.url;
  
  debug("Configuration Server Event",url);
  if (url == "/?installmode") {
    // query new devices from Hue and send them to Rega
    debug("Send my Devices to Rega");
    hm_layer.sendRPCMessage("newDevices",hm_layer.getMyDevices(), function(error, value) {});
  }

});

hm_layer.init();
log(chalk.gray("hm interface layer is up and listening ...."));
} 
