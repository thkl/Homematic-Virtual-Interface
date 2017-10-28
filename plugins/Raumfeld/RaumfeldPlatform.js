'use strict'

const path = require('path')
const fs = require('fs')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var os = require('os')
var RaumkernelLib = require('node-raumkernel');
var RaumfeldPlayer = require(path.join(__dirname,'RaumfeldPlayer.js'))

function RaumfeldPlatform (plugin, name, server, log, instance) {
  RaumfeldPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(RaumfeldPlatform, HomematicVirtualPlatform)

RaumfeldPlatform.prototype.init = function () {
 
  var that = this
  this.players = []
  this.raumkernel = new RaumkernelLib.Raumkernel()


  var devfile = path.join(__dirname,'HM-RC-19_Raumfeld.json')
  var buffer = fs.readFileSync(devfile);
  var devdata = JSON.parse(buffer.toString());
  this.server.transferHMDevice('HM-RC-19_Raumfeld',devdata);
  this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

  this.raumkernel.createLogger(0,os.tmpdir());
  this.raumkernel.init();
  this.log.info('raumkernel launched')

  this.raumkernel.on('mediaRendererRaumfeldAdded', function(_deviceUdn, _device){
    if (!that.hazPlayer(_deviceUdn)) {
	    that.log.debug('New  Renderer added uDN %s with Name %s',_deviceUdn,_device.name())
	    var player = new RaumfeldPlayer(that,_deviceUdn,_device.name())
	    player.volume_steps = this.volume_steps
		that.players.push(player)
	} else {
	    that.log.debug('skip renderer %s because it exists.',_deviceUdn)
	}
  })


  this.raumkernel.on('rendererStateKeyValueChanged', function(_mediaRenderer, _key, _oldValue, _newValue, _roomUdn){
		if (_newValue != undefined) {
			that.log.debug('%s on room: %s changed to  %s', _key, _mediaRenderer.udn() , _newValue.toString())
			that.log.debug('NewValue is %s',(typeof _newValue))
			that.log.debug ('try to find renderer to update')
			that.updatePlayerState(_mediaRenderer.udn(),_key,_newValue)
		}
  })
/*
  	    var player = new RaumfeldPlayer(this,"uuid:c2dbc9bf-56d0-45b4-b753-8dcc6315243b","Dummy")
		this.players.push(player)  
*/ 
  this.configuration = this.server.configuration
  this.plugin.initialized = true
  this.log.debug('initialization completed %s', this.plugin.initialized)
  
  this.volume_steps = this.configuration.getValueForPlugin(this.name,"volume_steps",5);
}

RaumfeldPlatform.prototype.hazPlayer = function (_deviceUdn) {
  var result = false
  this.players.some(function(player){
	  if (player.deviceUdn == _deviceUdn) {
		  result = true
	  }
  })
  return result
}

RaumfeldPlatform.prototype.getPlayer = function (_deviceUdn) {
  var result = undefined
  this.players.some(function(player){
	  if (player.deviceUdn == _deviceUdn) {
		  result = player
	  }
  })
  
  return result
}

RaumfeldPlatform.prototype.getPlayersForVirtualRenderer = function (_deviceUdn) {
  var result = []
  var that = this 
  let vr =  this.raumkernel.managerDisposer.deviceManager.getVirtualMediaRenderer(_deviceUdn)
  this.log.debug('try to get virtual renderer for %s',_deviceUdn)
  if (vr != undefined) {
	  this.log.debug('found one')
	  let rudns = vr.getRoomRendererUDNs()
	  rudns.some(function(unds){
	  	let player = that.getPlayer(unds)
	  	if (player != undefined) {
		  result.push(player)
		}
	  })
  }
  return result
}


RaumfeldPlatform.prototype.updatePlayerState = function (_deviceUdn,key,newValue) {
  let player = this.getPlayer(_deviceUdn)
  if (player != undefined) {
	  this.log.debug('Player found will update status for key %s',key)
	  player.update(key,newValue)
  } else {
	  this.log.error('No player with %s found try virtual renderer',_deviceUdn)
	  let playerz = this.getPlayersForVirtualRenderer(_deviceUdn)
	  playerz.some(function(player) {
		  player.update(key,newValue)
	  })
  }
}


RaumfeldPlatform.prototype.showSettings = function(dispatched_request) {
	this.localization.setLanguage(dispatched_request);

	var result = [];
	result.push({"control":"text",
					"name":"volume_steps",
				   "label":this.localization.localize("Volume will be inc or dec on each keypress"),
				   "value":this.volume_steps || 5
	});

	
	return result;
}

RaumfeldPlatform.prototype.saveSettings = function(settings) {
	var volume_steps = settings.volume_steps;
	
	if  (volume_steps) {
		this.volume_steps = volume_steps;
		this.configuration.setValueForPlugin(this.name,"volume_steps",volume_steps); 
		this.players.some(function(player){
			player.volume_steps = volume_steps;
		});
	}
}

RaumfeldPlatform.prototype.myDevices = function() {
	// return my Devices here
	var result = [];
	result.push({"id":"sep-son","name":"--------- Raumfeld Devices ---------","type":"seperator"});

	this.players.forEach(function(player){
		result.push({"id":player.serial,"name":player.deviceName,"udn":player.serial,"type":"Raumfeld"});
	});
	return result;	
}


RaumfeldPlatform.prototype.handleConfigurationRequest = function (dispatched_request) {
  var template = 'index.html'
  var requesturl = dispatched_request.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  var devtemplate = dispatched_request.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
  var cfg_handled = false
  
  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  }
  
  if (cfg_handled == false) {
	this.players.some(function (player){
		deviceList = deviceList +  dispatched_request.fillTemplate(devtemplate,{"device_name":player.deviceName,"device_hmdevice":player.serial});
	
	});
	
  }
  
  dispatched_request.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}



module.exports = RaumfeldPlatform
