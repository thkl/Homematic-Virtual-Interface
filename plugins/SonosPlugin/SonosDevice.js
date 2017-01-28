
var HomematicDevice;
var Sonos = require('sonos').Sonos;

var SonosDevice = function(plugin ,sonosIP,sonosPort,playername) {

	var that = this;
	this.log = plugin.log;
	this.ip = sonosIP;
	this.port = sonosPort;
	this.playername = playername;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	this.sonos = new Sonos(sonosIP,	sonosPort);

    // Add Event Handler
    
    var x = this.sonos.getEventListener();
	x.listen(function (err) {

		x.addService('/MediaRenderer/AVTransport/Event', function (error, sid) {
			that.log.debug('Successfully subscribed, with subscription id', sid)
  		});

  		x.addService('/MediaRenderer/RenderingControl/Event', function (error, sid) {
			that.log.debug('Successfully subscribed, with subscription id', sid)
  		});

  		x.on('serviceEvent', function (endpoint, sid, event) {
	  		
	  		if (event.name == "RenderingControlEvent") {
				if (event.volume.Master) {
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
	  		
  		});
	});

	HomematicDevice = plugin.server.homematicDevice;


	this.hmDevice = new HomematicDevice();
	
	
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
				that.sonos.setVolume(newVolume, function (err, playing) {})
		    }
		    
		    if (parameter.name == "PLAYLIST") {
			    
			    var playlist = parameter.newValue;
				if (playlist.indexOf("spotify") > -1) {
					 that.sonos.flush(function (err, flushed) {
						 that.sonos.addSpotifyPlaylist(playlist,function (err, playing) {
							 that.sonos.play(function (err, playing) {})
							})
					});
				}

		    }
		    
	    }
	});
}

SonosDevice.prototype.functionForChannel=function(type,channel) {
	var result = channel.getParamsetValueWithDefault("MASTER","CMD_" + type,"");
	return result;
}

module.exports = {
	  SonosDevice : SonosDevice
}

