
"use strict";

var HomematicDevice;
var Sonos = require('node-sonos').Sonos;

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
	this.groupCoordinator
	this.isCoordinator
	this.currentPlayMode
	this.transportState
	this.currentVolume
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
		  		that.currentVolume = event.volume.Master
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
						if (event.transportState) {
							that.transportState = event.transportState
							channel.updateValue("TRANSPORT_STATE",that.transportState,true);
							// Check if we hat to continue a queue
							if (event.transportState=="STOPPED") {
								 process.nextTick(function() {
									 that.continueOldPlayList()
								 })
							}
						}
						if (event.currentPlayMode) {
							that.currentPlayMode = event.currentPlayMode
							channel.updateValue("PLAY_MODE",that.currentPlayMode,true);
						}
						
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
					that.play(function (err, playing) {})
				break;
				case "Pause": 
					that.pause(function (err, playing) {})
				break;
				case "Stop": 
					that.stop(function (err, playing) {})
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
			    that.log.info("%s SetVolumeRequest %s",that.playername,newVolume);
			    // Do it step by step
			    if (that.volumeRampTime > 0) {
				    that.log.info("%s ramping volume to %s",that.playername,newVolume);
				    that.rampToVolume(newVolume);
				    channel.updateValue("TARGET_VOLUME",newVolume,true,true,true);
			    } else {
				    that.setVolume(newVolume,function(err){
					    channel.updateValue("TARGET_VOLUME",newVolume,true,true,true);
					    that.log.error(err)
				    });
			    } 
		    }
		    
		    if (parameter.name == 'COMMAND') {
			    var cmds = parameter.newValue.split('|');
				if (cmds.length>0) {
					var cmd = cmds[0];
					that.log.info("Sonos Zone Player %s Command %s received",that.playername,cmd)
					switch (cmd) {
					
						case 'playlist':
						{
							if (cmds.length>1) {
								that.setPlayList(cmds[1])	
					  		} else {
						  		that.log.error("missing playlist in command")
					  		}
						}
						break;
					
						case 'say':
						{
							if (cmds.length>1) {
								that.say(cmds[1])	
					  		} else {
						  		that.log.error("missing text to say in command")
					  		}
						}
						break;

						case 'autovolume':
						{
							that.rampAutoVolume(false)	
						}
						break;
						
						case 'setvolume':
						{
							if (cmds.length>1) {
								var newVolume = cmds[1];
								that.setVolume(newVolume,function(err){
									channel.updateValue("TARGET_VOLUME",newVolume,true,true,true);
									that.log.error(err)
				    			});	
					  		}	
						}
						break;
						
						case 'enablesub':
						{
							if (cmds.length>1) {
								that.enablesub(cmds[1])	
					  		}
						}
						break;

						case 'settransportstream':
						{
							if (cmds.length>1) {
								that.setTransportStream(cmds[1])	
					  		} else {
						  		that.log.error("missing transport stream in command")
					  		}
						}
						break;
						
						
						case 'playFav':
						{
							if (cmds.length>1) {
							  that.playFav(cmds[1])
					  		} else {
						  		that.log.error("missing fav name in command")
					  		}
						}
						break;
					}
		    	}
		     channel.updateValue("COMMAND","");
			}
	    }
	    
	});
}


SonosDevice.prototype.playFav = function(title) {
  var that = this
  this.sonos.searchMusicLibrary('favorites','2',{start: 0, total: 100},function(err,result){
		  var items = result.items;
		  items.forEach(function(item){
			if (item.title==title)	{
				item.uri = item.uri.replace("&", "&amp;");
// Quick and f*cking dirty
				item.uri = item.uri.replace("sid=254&amp;flags=8224&sn=0","sid=254&amp;flags=32")
				that.sonos.queueNext(item,function(err,result){
					that.log.error("Result %s",err)
					that.sonos.play();
				});
			}		  
		  });
	  });
}


SonosDevice.prototype.setPlayList = function(playlist) {
	var that = this;
	if (playlist.indexOf('spotify') > -1) {
		 this.sonos.flush(function (err, flushed) {
			that.log.info("spotify playlist found ")
			that.sonos.addSpotifyPlaylist(playlist,function (err, playing) {
				that.log.error("playlist added to %s -> %s",that.playername,err)

			that.sonos.play(function (err, playing) {
				that.log.error("player %s start %s",that.playername,err)

			})
		})
	})
	
	}
	
	if (playlist.indexOf('radio://') == 0) {
		 this.sonos.flush(function (err, flushed) {
		 	var name = "Radio"
		 	var parentID = "R:0/0"
		 	var id = "R:0/0/0"
		 	var uri = 'x-rincon-mp3' + playlist;
		 	
		 	var meta = "&lt;DIDL-Lite xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot; xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot; xmlns:r=&quot;urn:schemas-rinconnetworks-com:metadata-1-0/&quot; xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;&gt;&lt;item id=&quot;"+id+"&quot; parentID=&quot;"+parentID+"&quot; restricted=&quot;true&quot;&gt;&lt;dc:title&gt;"+name+"&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.audioItem.audioBroadcast&lt;/upnp:class&gt;&lt;desc id=&quot;cdudn&quot; nameSpace=&quot;urn:schemas-rinconnetworks-com:metadata-1-0/&quot;&gt;SA_RINCON65031_&lt;/desc&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;"

		 	that.log.info("Try queue %s on %s",uri,that.playername)
		 	that.sonos.queue({
			 		uri: uri,
			 		metadata: meta
			}, function (error,data) {
				if (!error) {
					
					that.sonos.play(function (err, playing) {
						that.log.error("player %s received transport stream start result %s",that.playername,err)
					})
				}
			})
		})
	}
	
}

SonosDevice.prototype.say = function(text) {
  var that = this;
  
  this.plugin.texttospeech(text,function(location){
		  	that.sonos.getPositionInfo(function (err,data){
			 
			 that.log.debug(JSON.stringify(data))
			 
			 if (data[0]) {
			  	that.cur_track = data[0]['Track']
			 }
			 
			 that.sonos.currentTrack(function (err,data){
				that.log.debug("CT %s",JSON.stringify(data))
				if (data) {
			  		that.cur_position = data['position']
			  		that.log.debug("Set Current Position to %s",that.cur_position)
			  	}
 

		    var name = "Say"
		 	var parentID = "R:0/0"
		 	var id = "R:0/0/0"
		 	var uri = 'x-rincon-mp3radio://' + location;
		 	
		 	var meta = "&lt;DIDL-Lite xmlns:dc=&quot;http://purl.org/dc/elements/1.1/&quot; xmlns:upnp=&quot;urn:schemas-upnp-org:metadata-1-0/upnp/&quot; xmlns:r=&quot;urn:schemas-rinconnetworks-com:metadata-1-0/&quot; xmlns=&quot;urn:schemas-upnp-org:metadata-1-0/DIDL-Lite/&quot;&gt;&lt;item id=&quot;"+id+"&quot; parentID=&quot;"+parentID+"&quot; restricted=&quot;true&quot;&gt;&lt;dc:title&gt;"+name+"&lt;/dc:title&gt;&lt;upnp:class&gt;object.item.audioItem.audioBroadcast&lt;/upnp:class&gt;&lt;desc id=&quot;cdudn&quot; nameSpace=&quot;urn:schemas-rinconnetworks-com:metadata-1-0/&quot;&gt;SA_RINCON65031_&lt;/desc&gt;&lt;/item&gt;&lt;/DIDL-Lite&gt;"

		 	that.sonos.queue({uri:uri,meta:meta} ,function (err, data) {
				if ((data) && (data[0])) {
					var tnum = data[0]['FirstTrackNumberEnqueued'];
					that.returnToOldPositionAndDeleteTrack = tnum

					that.sonos.selectTrack(tnum,function(err,success){
						that.sonos.play(function(){});
					})
				}			 	
		 	})
		})
	})

  })
 }


SonosDevice.prototype.continueOldPlayList = function() {
	
   var that = this	
   if (this.returnToOldPositionAndDeleteTrack > 0 ) {
		that.log.info("We have an old Playlist %s to continue on %s ",that.cur_position,that.playername)

		that.sonos.selectTrack(that.cur_track,function(err,success){
			that.log.debug("Restore to %s",that.cur_position)
			that.sonos.seek(that.cur_position,function(err,success){
				that.sonos.play(function(){
					  this.cur_position = 0
				});
			})
			})
   }
  // delete this track : 
  this.sonos.removeTrackFromQueue(this.returnToOldPositionAndDeleteTrack,function(err,result){
	  that.returnToOldPositionAndDeleteTrack = 0
  })
}

SonosDevice.prototype.setRampTime = function(newTime) {
 	this.log.debug("Set new Volume Ramp Time %s",newTime);
 	this.volumeRampTime = newTime;
}

SonosDevice.prototype.enableSub = function(enable) {
    this.sonos.enableSub(enable,function (error,result){})
}


SonosDevice.prototype.setTransportStream = function(newStream) {
	var newTs = "x-rincon-stream:" + newStream
    var that = this
    this.log.debug("Set Transport Stream of %s to %s",this.playername,newTs)
    this.sonos.flush(function (){
  	  that.sonos.queueNext({uri: newTs,metadata: ""}, function (error,data) {
		if (!error) {
			that.sonos.play(function (err, playing) {})
		} else {
			that.log.error("set Transport Stream error %s",error)
		}
	})
	})
}


SonosDevice.prototype.rampAutoVolume = function(increase) {
   // If user has set a autovolume table setup the volume
   this.log.info("Set new Volume Ramp %",this.playername);
   if (this.plugin.volumeTable) {
	   var hour = new Date().getHours()
	   var vt = this.plugin.volumeTable.split(',')
	   if (vt.length>hour) {
	   	var newVolume = parseInt(vt[hour].trim())
	   	if ((this.currentVolume > newVolume) || (increase==true)) {
		   	this.rampToVolume(newVolume)
	   	}
   	   }
   }
}

SonosDevice.prototype.rampToVolume = function(newVolume) {
	var that = this;
	this.sonos.getVolume(function (err, volume) {
		that.log.debug("%s Current Volume %s",that.playername,volume);
	  if (newVolume < volume) {
		  that.volumeSlide = true;
		  that.setVolume(volume - 1, function (err) {
			  setTimeout(function() {that.rampToVolume(newVolume)}, that.volumeRampTime);
		  });
		  return;
	  } 

	  if (newVolume > volume) {
		  that.volumeSlide = true;
		  that.setVolume(volume + 1, function (err) {
			  setTimeout(function() {that.rampToVolume(newVolume)}, that.volumeRampTime);
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
		   var tmp = result['CurrentZoneGroupID']
		   var players = result['CurrentZonePlayerUUIDsInGroup']
		   if (tmp) {
			   var channel = that.hmDevice.getChannel(that.hmDevice.serialNumber + ":19");
				  if (channel) {
					  var firstGroupMember = players.split(',')[0]
					  if (firstGroupMember) {
						  that.isCoordinator = (firstGroupMember == that.rincon)
						  channel.updateValue("COORDINATOR",that.isCoordinator,true)
						  var player = that.plugin.getPlayerByRinCon(firstGroupMember)
						  that.groupCoordinator = (player) ? player['playername'] : firstGroupMember
						  channel.updateValue("ZONEGROUPID",that.groupCoordinator,true)
					  }
				  } 
			   } else {

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

SonosDevice.prototype.stop = function(callback) {
	this.sonos.stop(function (err, playing) {
			callback(err);
	})
}


SonosDevice.prototype.play = function(callback) {
	this.sonos.play(function (err, playing) {
			callback(err);
	})
}

SonosDevice.prototype.pause = function(callback) {
	this.sonos.pause(function (err, playing) {
			callback(err);
	})
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

