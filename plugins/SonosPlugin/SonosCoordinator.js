'use strict'

//
//  SonosCoordinator.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 25.02.2017.
//  Copyright © 2017 kSquare.de. All rights reserved.
//


var HomematicDevice
var Sonos = require('node-sonos').Sonos
var path = require('path');
const async = require('async');
const fs = require('fs');

var appRoot = path.dirname(require.main.filename);

if (appRoot.endsWith("bin")) {appRoot =  appRoot+"/../lib";}

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

var SonosCoordinator = function(plugin) {
	var that = this
	this.log = plugin.log
	this.plugin = plugin
	this.configuration = plugin.configuration
	this.bridge = plugin.server.getBridge()
	this.zonePlayer = {}
	this.init()
}

SonosCoordinator.prototype.init = function() {
	var that = this
	HomematicDevice = this.plugin.server.homematicDevice
	this.hmDevice = new HomematicDevice(this.plugin.getName())
	var devName = 'SONOS_Coordinator'
	var data = this.bridge.deviceDataWithSerial(devName)
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data)
	} 
	
	if (this.hmDevice.initialized == false) {
		this.hmDevice.initWithType("HM-RC-Key4-2", devName)
		this.bridge.addDevice(this.hmDevice,true)
	} else {
		this.bridge.addDevice(this.hmDevice,false)
	}

	this.hmDevice.on('device_channel_value_change', function(parameter){
		that.log.debug("Sonos Coordinator Command Event %s with %s",parameter.name,parameter.newValue)
		var newValue = parameter.newValue
		var channel = that.hmDevice.getChannel(parameter.channel)
		
		if (parameter.name == 'COMMAND') {
			
			var cmdList = parameter.newValue.split('*')
			cmdList.forEach(function (command){
			    
			var cmds = command.split('|')
			if (cmds.length>0) {
				var cmd = cmds[0]
				that.log.info("Coordinator Command %s set (%s %s)",cmd,cmds[1],cmds[2])
				switch (cmd) {

					case 'standalone':
					{
						if (cmds.length>1) {
							that.removeZonePlayer(cmds[1])	
						}
					}
					break
					
					case 'createmesh':
					{
						if (cmds.length>1) {
							that.createMesh(cmds[1])	
						}
					}
					break
					
					case 'toggle':
					{
						if (cmds.length>1) {
							that.toggle(cmds[1])	
						}
					}
					
					break;
					
					case 'switchon':
					{
						if (cmds.length>1) {
							that.switchon(cmds[1])	
						}
					}
					break;

					case 'switchoff':
					{
						if (cmds.length>1) {
							that.switchoff(cmds[1])	
						}
					}
					break;
					
					case 'playFav':
					{
						if (cmds.length>2) {
							if (cmds[2].toLowerCase() == "random") {
								that.playRandomFavPlayList(cmds[1])
							} else {
								that.playFav(cmds[1],cmds[2]);
							}
						}
					}
					break;
					
					case 'autoVolume':
					{
						that.rampToAutoVolume()
					}
					break;
					
					
					case 'volume':
					{
						if (cmds.length>1) {that.rampToVolume(cmds[1])}
					}
					break;

					case 'settransportstream':
					{
						if (cmds.length>2) {that.setTransportStream(cmds[1],cmds[2])}
					}
					break;
				}
			}
			})
			// Reset Command
			channel.updateValue('COMMAND','');
		}
	})

}

SonosCoordinator.prototype.rampToAutoVolume = function() {
  var that = this 
  Object.keys(this.zonePlayer).forEach(function (deviceSerial) {
  	   that.log.info("Ramp To Auto Volume %s",deviceSerial)
	   var player = that.zonePlayer[deviceSerial]
       player.rampAutoVolume(false)
  })
}


SonosCoordinator.prototype.setTransportStream = function(deviceSerial,newStream) {
	var newTs = "x-rincon-stream:" + newStream
    var that = this
	var playerDevice = this.getZonePlayerDevice(deviceSerial)
	if (playerDevice) {
	   this.log.debug("Player %s found. Set Ts to %s",deviceSerial,newStream)
	   playerDevice.setTransportStream(newStream)
	}
}


SonosCoordinator.prototype.rampToVolume = function(newVolume) {
  var that = this 
  Object.keys(this.zonePlayer).forEach(function (deviceSerial) {
  	   that.log.info("Ramp To  Volume %s %s",deviceSerial,newVolume)
	   var player = that.zonePlayer[deviceSerial]
       player.rampToVolume(newVolume)
  })
}


SonosCoordinator.prototype.toggle = function(deviceSerial) {
  // Remove from group if playing
  this.log.debug("Toggeling %s",deviceSerial)
  var playerDevice = this.getZonePlayerDevice(deviceSerial)
  if (playerDevice) {
	  if (playerDevice.transportState == "PLAYING") {
		  this.switchoff(deviceSerial)
	  } else {
   		  this.switchon(deviceSerial)
		}
	  
  } else {
	this.log.error("No Device found for %s",deviceSerial)
  }
}


SonosCoordinator.prototype.switchoff = function(deviceSerial) {
  // Remove from group if playing
  var that = this
  this.log.info("SwitchOff %s",deviceSerial)
  var playerDevice = this.getZonePlayerDevice(deviceSerial)
  if (playerDevice) {
	  if (playerDevice.transportState == "PLAYING") {
		  this.removeZonePlayer(deviceSerial,function(result){
			  that.log.info("Zone Player is now Standalone %s",result)
			  playerDevice.stop(function(error){
			  	that.log.info("Zone Player is now Off %s",error)
			  })
		  })
	  }
  } else {
	this.log.error("No Device found for %s",deviceSerial)
  }
}


SonosCoordinator.prototype.playFav = function(deviceSerial,title) {
  var that = this
  this.log.info("Search for Playlist %s",title)
  var playerDevice = this.getZonePlayerDevice(deviceSerial)
  if (playerDevice) {
	  this.log.debug('Player found ...')
	  playerDevice.playFav(title)
  } else {
	this.log.error("No Device found for %s",deviceSerial)
  }
}



SonosCoordinator.prototype.playRandomFavPlayList = function(deviceSerial) {
  var that = this
  this.log.info("play random list")
  var plitems = []
  var playerDevice = this.getZonePlayerDevice(deviceSerial)
  if (playerDevice) {
	  playerDevice.sonos.searchMusicLibrary('favorites','2',{start: 0, total: 100},function(err,result){
		  var items = result.items;
		  items.forEach(function(item){
			
			if (item.uri.startsWith('x-rincon-cpcontainer')) {
				plitems.push(item)
			}
		  })
		  
		  var ln = plitems.length
		  var sl = parseInt(Math.random() * (ln))
		  var selItem = plitems[sl]
		  that.log.debug("%s items Selected (%s) %s",ln,sl,JSON.stringify(selItem))
		  playerDevice.playFav(selItem.title)						
	  });
  } else {
	this.log.error("No Device found for %s",deviceSerial)
  }
}



SonosCoordinator.prototype.switchon = function(deviceSerial) {
  // Remove from group if playing
  this.log.info("SwitchOn %s",deviceSerial)
  var that = this
  var playerDevice = this.getZonePlayerDevice(deviceSerial)
  if (playerDevice) {
	if (playerDevice.transportState != "PLAYING") {
		  this.log.debug("TransportState of %s is not Playing",deviceSerial)
		  var playing = this.findPlayingDevice()
		  if (playing) {
		  	  this.log.debug("There is Music playing -> adding %s to %s",deviceSerial,playing)
		  	  this.addtogroup(playing,deviceSerial)
  			  this.fadeIn(deviceSerial)
		  } else {
			  // Set a Default Playlist
		  	  this.log.debug("There is silence check default playlist")
			  var default_playlist = this.configuration.getValueForPlugin(this.plugin.name,"default_playlist",undefined);
			  if (default_playlist) {
			  	  this.log.debug("%s found. Set Playlist",default_playlist)
				  playerDevice.setPlayList(default_playlist)
			  }
			  // If the user set a autovolume table fade in to that volume
		  	  this.log.debug("Set fading and start playing")
			  this.fadeIn(deviceSerial)
			  playerDevice.play()
		  }
	} 
  } else {
	this.log.error("No Device found for %s",deviceSerial)
  }
}


SonosCoordinator.prototype.fadeIn = function(deviceSerial) {
	if (this.plugin.volumeTable) {
	    var playerDevice = this.getZonePlayerDevice(deviceSerial)
	    if (playerDevice) {
			this.log.debug("user has a volume table fade in")
				playerDevice.setVolume(0,function (err){
					playerDevice.rampAutoVolume(true)		  
		    	})
	    }
	}
}

SonosCoordinator.prototype.findPlayingDevice = function() {
	var that = this
	var result = undefined
	
	Object.keys(this.zonePlayer).forEach(function (deviceSerial) {
       var player = that.zonePlayer[deviceSerial]
       that.log.debug("State of %s is %s",deviceSerial,player.transportState)
       if ((player.transportState == "PLAYING") && (player.isCoordinator)) {
	       result = deviceSerial
       } 
    });
	that.log.debug("Will return %s as playing coordinator",result)
    return result
}

SonosCoordinator.prototype.createMesh = function(deviceSerials) {
    try {
    var that = this
    var players = deviceSerials.split(',')
    var newCoordinator = players[0]
    var calls = [];
    
    var newCoordinatorDevice = this.getZonePlayerDevice(newCoordinator)
    // Get the new Coordinator Device
    if (newCoordinatorDevice) {
	    that.log.debug("New Coordinator is %s",newCoordinator)
	    // first transfer existing group coordinator
		var groupCoordinator = newCoordinator.groupCoordinator
		// if oldCoodinator is set groupd the devices to be able to transfer Coordinator
		that.transfer(groupCoordinator,newCoordinator,function(){

		// then remove all from existing Groups
		players.some(function (player){
			calls.push(function(callback) {
				that.log.debug("Remove %s from group",player)
		    	that.removeZonePlayer(player)
				callback();			
    	})
    	})
		
	
		// then add all to the new coordinator
	
		players.some(function (player){
			if (player != newCoordinator) {
				that.log.debug("Add %s to group",player)
				calls.push(function(callback) {
				that.addtogroup(newCoordinator,player)
				callback()

			})
			}
		})    

		that.log.debug("run all stuff async")
		async.parallel(calls, function(err, result) {
			if (err)
				that.log.error(result);
		});

			
		})

    } else {
	    that.log.error("Coordinator not found. Did you spell your players right ?")
    }
    } catch (e) {
	    this.log.error(e.stack)
    }
}


// Transfer the Coordinator Ownership to another Player
SonosCoordinator.prototype.transfer = function(fromdeviceSerial,newCoordinator,callback) {
    var that = this
		// if the new Coordinator is not the existing 
	if ((fromdeviceSerial) && (fromdeviceSerial!=newCoordinator)) {
		var newCoordinatorDevice = this.getZonePlayerDevice(newCoordinator)
		if (newCoordinatorDevice) {
			this.log.debug("Have to transfer Coordinator from %s to %s",fromdeviceSerial,newCoordinator)
			var groupCoordinatorDevice = this.getZonePlayerDevice(fromdeviceSerial)
			groupCoordinatorDevice.sonos.delegateGroupCoordinationTo(newCoordinatorDevice.rincon,function (result){
				if (callback) {
					callback(result)
				}						  
			})
		} else {
			this.log.error("No Device with Name %s found for new Coordinator",newCoordinator)
			if (callback) {
				callback()
			}						  
		}	
	} else {
		this.log.debug("New coordinator is allready set")
		if (callback) {
			callback()
		}						  
	}
}

SonosCoordinator.prototype.removeZonePlayer = function(deviceSerial,callback) {
	var that = this
	var zoneplayer = this.getZonePlayerDevice(deviceSerial)
	if (zoneplayer) {
	   that.log.debug("Zoneplayer %s found. Set as standalone",deviceSerial)
	   zoneplayer.sonos.becomeCoordinatorOfStandaloneGroup(function (result){
	   	that.log.debug("Result %s",result)		
		if (callback) {
			callback(result)
		}   
		})
    } else {
	   that.log.error("No ZonePlayer with Name %s",deviceSerial)
		if (callback) {
			callback(result)
		}   
    }
}

SonosCoordinator.prototype.addtogroup = function(groupCoordinator,deviceSerial,callback) {
	var that = this
	var groupCoordinatorDevice = this.getZonePlayerDevice(groupCoordinator)
	var playerdevice = this.getZonePlayerDevice(deviceSerial)
		if ((playerdevice) && (groupCoordinatorDevice)) {
				this.log.debug('Add %s to group with %s',deviceSerial,groupCoordinator)
				groupCoordinatorDevice.sonos.addPlayerToGroup(playerdevice.rincon,function (error,result){
					playerdevice.sonos.queueNext('x-rincon:'+groupCoordinatorDevice.rincon,function(error,result){
					   if (callback) {
						   callback(result)
					   }
					})
				})	
		} else {
			if (callback) {
			   callback(result)
			}
		}		
}

SonosCoordinator.prototype.addZonePlayer = function(sonosDevice) {
	this.zonePlayer[sonosDevice.serial] = sonosDevice
}

SonosCoordinator.prototype.getZonePlayerDevice = function(deviceSerial) {	
	return this.zonePlayer[deviceSerial]
}

module.exports = {
	  SonosCoordinator : SonosCoordinator
}