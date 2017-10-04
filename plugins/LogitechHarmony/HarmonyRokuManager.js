//
//  HarmonyRokuManager.js
//  Homematic Virtual Interface Plugin
//



"use strict";

var http = require('http');
var http = require('http');
var httpHeaders = require('http-headers');

var HarmonyRokuManager = function (plugin) {
   this.log = plugin.log;
   this.plugin = plugin;
   this.server = this.plugin.server;
   this.log.debug("RokuManager init")
}

HarmonyRokuManager.prototype.addRoku = function(roku) {
   this.log.debug("RokuManager add Roku %s",roku.rokuInstance)
   this.server.addSSDPService({"owner":"hue","st":"urn:schemas-upnp-org:device:basic:1","payload":roku.ssdp_response})
}

HarmonyRokuManager.prototype.startDiscovery = function() {
    this.log.debug("RokuManager gtfo")
}

HarmonyRokuManager.prototype.unref = function() {
}

HarmonyRokuManager.prototype.stopDiscovery = function() {
}


module.exports = {
  HarmonyRokuManager : HarmonyRokuManager
}