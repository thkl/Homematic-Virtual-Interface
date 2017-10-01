//
//  HarmonyRokuManager.js
//  Homematic Virtual Interface Plugin
//



"use strict";

var http = require('http');
var dgram = require('dgram');
var http = require('http');
var httpHeaders = require('http-headers');

var HarmonyRokuManager = function (plugin) {
   this.items = [];
   this.log = plugin.log;
   this.log.debug("RokuManager init")
}

HarmonyRokuManager.prototype.addRoku = function(roku) {
   this.log.debug("RokuManager add Roku %s",roku.rokuInstance)
  this.items.push(roku)
}

HarmonyRokuManager.prototype.startDiscovery = function() {
    var that = this
    
    this.log.debug("RokuManager start Discovery")

    this.socket = dgram.createSocket({type: 'udp4', reuseAddr: true});
    this.socket.on("error", function (error) {
            that.log.error("RokuManager FakeRoku Error : %s",error)
            that.stopDiscovery();
        }
    );

    this.socket.on("message", function (msg, rinfo) {
            if (msg.toString().match(/^(M-SEARCH) \* HTTP\/1.\d/)) {
                var headers = httpHeaders(msg);
                if (headers.man === '"ssdp:discover"') {
                    that.items.forEach(function (roku) {
	                    that.socket.send(roku.ssdp_response, 0, roku.ssdp_response.length, rinfo.port, rinfo.address);
                    })
                }
            } else if (msg.toString().match(/^(NOTIFY) \* HTTP\/1.\d/)) {
                //@todo
            }
        }
    );
    
    this.log.debug("RokuManager start DGram")
    this.socket.bind(1900, "0.0.0.0", function () {
	    if (that.socket != undefined) {
	        that.socket.addMembership("239.255.255.250");
			that.log.debug("listening on 0.0.0.0:1900");
        }
    });
    this.log.debug("RokuManager gtfo")
}

HarmonyRokuManager.prototype.unref = function() {
   this.socket.unref();
}

HarmonyRokuManager.prototype.stopDiscovery = function() {
    if (this.socket && this.socket._bindState) this.socket.close();
}


module.exports = {
  HarmonyRokuManager : HarmonyRokuManager
}