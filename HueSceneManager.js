	"use strict";


var Channel = require(__dirname + "/HomematicChannel.js").HomematicChannel;
var Device = require(__dirname +"/HomematicDevice.js").HomematicDevice;
var debug = require('debug')('HomeMaticHueBridge.HueSceneManager');

var HueSceneManager = function(hmbridge, hueApi) {

    this.mappedScenes = [];
    this.hmDevices = [];
    this.hueApi = hueApi;
    
    if (hmbridge == undefined) {
	   throw("HM Layer was not set correctly");
    }
    this.bridge = hmbridge;
    
}

HueSceneManager.prototype.addScene = function(scene) {
	
	this.mappedScenes.push(scene);
}

HueSceneManager.prototype.publish = function() {
  /* what do we do here
  First find out how many RemoteControls we need by dividing / 19
  and then initialize alle the remotes
  */
  
  var i = 1;
  var cnt = 0;
  var that = this;
  
  this.addHMRemote("HUESCENE00"  + cnt);
  
  this.mappedScenes.map(function(scene){
    scene["hmchannel"] = "HUESCENE00"  + cnt + ":"+i;
    
    i=i+1;
    if (i>19) {
	   i=1;
	   cnt = cnt + 1; 
	   that.addHMRemote("HUESCENE00"  + cnt);
    }	  
  });
}

HueSceneManager.prototype.addHMRemote = function(remoteName) {
	var hmDevice = new Device("HM-RC-19", remoteName);
    this.hmDevices.push(hmDevice);
    this.bridge.addDevice(hmDevice);
    var that = this;
    
    hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = hmDevice.getChannel(parameter.channel);
		if (parameter.name == "PRESS_SHORT") {
			that.mappedScenes.map(function (scene){
				if (scene["hmchannel"] == channel.adress) {
					debug("Scene found " + scene["name"] +  " will run that");
					that.hueApi.activateScene(scene["id"],function(err, result) {});
				}
			});
	    }
	});
}

HueSceneManager.prototype.listMapping = function() {
  var resultStr;
  
  this.mappedScenes.map(function (scene){
     resultStr = resultStr + "Scene : " + scene["name"] + " is mapped to remote control button " + scene["hmchannel"] + "<br />\n";
  });
  return resultStr;
}

module.exports = {
	HueSceneManager : HueSceneManager
}
