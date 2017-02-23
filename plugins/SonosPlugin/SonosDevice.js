
var HomematicDevice;
var Sonos = require('sonos').Sonos;

var SonosDevice = function(plugin ,sonosIP,sonosPort,playername) {

	var that = this;
	this.log = plugin.log;
	this.plugin = plugin;
	this.ip = sonosIP;
	this.port = sonosPort;
	this.playername = playername;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	this.sonos = new Sonos(sonosIP,	sonosPort);
	this.volumeSlide = false;
	this.maxVolume = 20;
    this.volumeRampTime = this.configuration.getValueForPlugin(plugin.name,"volume_ramp_time",0);

// Add Event Handler
    
    
    this.player = this.sonos.getEventListener();
	this.player.listen(function (err) {

		that.player.addService('/MediaRenderer/AVTransport/Event', function (error, sid) {
			that.log.debug('Successfully subscribed, with subscription id %s', sid)
  		});

  		that.player.addService('/MediaRenderer/RenderingControl/Event', function (error, sid) {
			that.log.debug('Successfully subscribed, with subscription id %s', sid)
  		});


  		that.player.on('error', function (error) {
	  	  that.log.error("Sonos Event Listener Error %s",error)
	  	})
	  	
  		that.player.on('serviceEvent', function (endpoint, sid, event) {
	  		
	  		if (event.name == "RenderingControlEvent") {
				if ((event.volume.Master) && (!that.volumeSlide)) {
					that.log.debug("Set new Volume %s",event.volume.Master);
					var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
					if (channel) {
						channel.updateValue("TARGET_VOLUME",event.volume.Master,true);
					}
				}	
	  		}
	  		
	  		if (event.name == "TransportControlEvent") {
		  		var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
					if (channel) {
						if (event.currentTrack) {channel.updateValue("CURRENT_TRACK",event.currentTrack.artist + ": " +event.currentTrack.title,true);}
						if (event.nextTrack) {channel.updateValue("NEXT_TRACK",event.nextTrack.artist + ": " +event.nextTrack.title,true);}
						if (event.transportState) {channel.updateValue("TRANSPORT_STATE",event.transportState,true);}
						if (event.currentPlayMode) {channel.updateValue("PLAY_MODE",event.currentPlayMode,true);}
					} 	
	  		}
	  		
	  		that.refreshZoneGroupAttrs()
	  		
  		});
	});


	this.refreshZoneGroupAttrs()
	
	HomematicDevice = plugin.server.homematicDevice;
	this.hmDevice = new HomematicDevice(this.plugin.getName());
	
	
	var data = this.bridge.deviceDataWithSerial(playername);
	if (data!=undefined) {
		this.hmDevice.initWithStoredData(data);
	} 
	
	if (this.hmDevice.initialized == false) {
		this.hmDevice.initWithType("HM-RC-19_Sonos", playername);
		this.bridge.addDevice(this.hmDevice,true);
	} else {
		this.bridge.addDevice(this.hmDevice,false);
	}
    
    this.hmDevice.on('device_channel_value_change', function(parameter){
			
		var newValue = parameter.newValue;
		var channel = that.hmDevice.getChannel(parameter.channel);
			var func = that.functionForChannel(parameter.name, channel);
			if (func != undefined) {
			switch (func) {
				case "Play": 
					that.sonos.play(function (err, playing) {})
				break;
				case "Pause": 
					that.sonos.pause(function (err, playing) {})
				break;
				case "Stop": 
					that.sonos.stop(function (err, playing) {})
				break;
				case "Prev": 
					that.sonos.previous(function (err, playing) {})
				break;
				case "Next": 
					that.sonos.next(function (err, playing) {})
				break;
				case "VolUp": 
					that.sonos.getVolume(function (err, volume) {
						volume = volume + 1;	
						that.sonos.setVolume(volume, function (err, playing) {})
					});
				break;
				case "VolDn": 
					that.sonos.getVolume(function (err, volume) {
						volume = volume - 1;	
						that.sonos.setVolume(volume, function (err, playing) {})
					});
				break;
				case "Spotify":
				   var url = channel.getParamsetValueWithDefault("MASTER","CMD_PRESS_LONG","");
				   that.sonos.flush(function (err, flushed) {that.sonos.addSpotifyPlaylist(url,function (err, playing) {that.sonos.play(function (err, playing) {})})});
				break;

				default: {
					switch (channel.index) {
						case "1": 
							that.sonos.play(function (err, playing) {})
						break;
						case "2": 
							that.sonos.pause(function (err, playing) {})
						break;
						case "3": 
							that.sonos.stop(function (err, playing) {})
						break;
						case "4": 
							that.sonos.previous(function (err, playing) {})
						break;
						case "5": 
							that.sonos.next(function (err, playing) {})
						break;
						case "6": 
							that.sonos.getVolume(function (err, volume) {
								volume = volume + 1;	
								that.sonos.setVolume(volume, function (err, playing) {})
								});
						break;
						case "7": 
							that.sonos.getVolume(function (err, volume) {
							volume = volume - 1;	
							that.sonos.setVolume(volume, function (err, playing) {})
							});
						break;
					}
				}
				break;
			}
	    } else {
		    
		    if (parameter.name == "TARGET_VOLUME") {
			    var newVolume = parameter.newValue;
			    that.log.debug("%s SetVolumeRequest %s",that.playername,newVolume);
			    // Do it step by step
			    if (that.volumeRampTime > 0) {
				    that.rampToVolume(newVolume);
				    channel.updateValue("TARGET_VOLUME",newVolume,true,true,true);
			    } else {
				    that.setVolume(newVolume,function(err){
					    channel.updateValue("TARGET_VOLUME",newVolume,true,true,true);
					    that.log.error(err	)
				    });
			    } 
		    }
		    
		    if (parameter.name == 'COMMAND') {
			    
			    var cmds = parameter.newValue.split('|');
				if (cmds.length>0) {
					var cmd = cmds[0];
					switch (cmd) {
						case 'standalone':
						{  
							that.sonos.becomeCoordinatorOfStandaloneGroup(function (result){});
						}
						break;
					
						case 'playlist':
						{
							if (cmds.length>1) {
								that.setPlayList(cmds[1])	
					  		}
						}
						break;
					
						case 'addto':
						{
							try {
							if (cmds.length>1) {
								// get master device
								var master = that.plugin.getPlayer(cmds[1])
								if (master) {
									master.sonos.addPlayerToGroup(master.rincon,function (result){
									  that.sonos.queueNext('x-rincon:'+master.rincon,function(result){
									  })
									})	
								} else {
									that.log.error("Master %s not found",cmds[1])
								}
								
					  		} else {
						  		that.log.error("Please select a master");
					  		}
					  	  } catch (e) {
						  	  that.log.error("%s",e.stack)
					  	  }
						}
						break;
					}
		    	}
			}
	    }
	});
}

SonosDevice.prototype.setPlayList = function(playlist) {
	var that = this;
	if (playlist.indexOf('spotify') > -1) {
		 this.sonos.flush(function (err, flushed) {
			that.sonos.addSpotifyPlaylist(playlist,function (err, playing) {
			that.sonos.play(function (err, playing) {})
		})
	})
	}
}


SonosDevice.prototype.setRampTime = function(newTime) {
	this.log.debug("Set new Volume Ramp Time %s",newTime);
 this.volumeRampTime = newTime;
}

SonosDevice.prototype.rampToVolume = function(newVolume) {
	var that = this;
	this.sonos.getVolume(function (err, volume) {
		that.log.debug("%s Current Volume %s",that.playername,volume);
	  if (newVolume < volume) {
		  that.volumeSlide = true;
		  that.log.debug("%s SetTo %s",that.playername,volume - 1);
		  that.setVolume(volume - 1, function (err) {
			  setTimeout(function() {that.rampToVolume(newVolume)}, this.volumeRampTime);
		  });
		  return;
	  } 
	  
	  if (newVolume > volume) {
		  that.volumeSlide = true;
		  that.log.debug("%s SetTo %s",that.playername,volume + 1);
		  that.setVolume(volume + 1, function (err) {
			  setTimeout(function() {that.rampToVolume(newVolume)}, this.volumeRampTime);
		  })
		  return;
	  }

	  that.volumeSlide = false;

	});
}

SonosDevice.prototype.refreshZoneGroupAttrs = function() {
	var that = this;
	that.sonos.getZoneGroupAttrs(function (error,result){
	   
	   if (result) {
		   var tmp = result['CurrentZoneGroupID'];
		   if (tmp) {
			   that.log.debug("CurrentZoneGroupID %s",tmp)
			   var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
			   var zoneGroupId = tmp.split(":")[0]
				  if (channel) {
					  channel.updateValue("COORDINATOR",(zoneGroupId == that.rincon),true)
					  var player = that.plugin.getPlayerByRinCon(zoneGroupId)
					  channel.updateValue("ZONEGROUPID",(player) ? player['playername'] : zoneGroupId,true)
					  
				  } 
			   } else {
				   that.log.error("CurrentZoneGroupID not found in %s",JSON.stringify(result))
			   }
		   } else {
			   that.log.error("Result %s Error %s",JSON.stringify(result),JSON.stringify(error))
		   }
	})	
}


SonosDevice.prototype.setVolume = function(newVolume,callback) {

	if (newVolume < parseInt(this.maxVolume)) {
		this.sonos.setVolume(newVolume, function (err, playing) {
			callback(err);
		})
	} else {
		this.log.warn("New Volume %s is above maximum %s",newVolume,this.maxVolume);
	}

}


SonosDevice.prototype.shutdown = function() {
  try {	
   this.player.removeService('/MediaRenderer/AVTransport/Event', function (error, sid) {});
   this.player.removeService('/MediaRenderer/RenderingControl/Event', function (error, sid) {});
  } catch (e) {}
}

SonosDevice.prototype.functionForChannel=function(type,channel) {
	var result = channel.getParamsetValueWithDefault("MASTER","CMD_" + type,"");
	return result;
}

module.exports = {
	  SonosDevice : SonosDevice
}

