"use strict";

var HomematicLogicalLayer = require(__dirname + "/LogicLayer.js").HomematicLogicalLayer;
var HueApi = require("node-hue-api").HueApi;
var HueDevice = require(__dirname + "/HueDevice.js").HueDevice;
var debug = require('debug')('HM Hue Bridge');
var Config = require(__dirname + '/settings.js').Config;

debug("Homematic Hue Bridge");

var configuration = new Config();

var hm_layer = new HomematicLogicalLayer(configuration.settings["ccu_ip"]);
var mappedDevices = [];

var hue_api;

var max = 3;

debug("Hue Bridge Init at " + configuration.settings["hue_bridge_ip"]);
hue_api = new HueApi(configuration.settings["hue_bridge_ip"], configuration.settings["hue_username"]);


// --------------------------
// Fetch Lights
hue_api.lights(function(err, lights) {

  if ((lights != undefined) && (lights["lights"]!=undefined)) {
  	lights["lights"].forEach(function (light) {
  	   if (max > 0) {
    		debug("Adding new Light " + light["name"]);
    		mappedDevices.push(new HueDevice(hm_layer,hue_api,light));
			max = max - 1;
       }
  });
  }  
  
 
});

hm_layer.init();


