
var HomematicDevice;
var Sonos = require('sonos').Sonos;

var SonosDevice = function(plugin ,sonosIP,sonosPort,playername) {

	var that = this;
	this.log = plugin.log;
	this.ip = sonosIP;
	this.port = sonosPort;
	this.configuration = plugin.configuration;
	this.bridge = plugin.server.getBridge();
	this.modules = {};
	this.sonos = new Sonos(sonosIP,	sonosPort);

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
				   
			}
	    } else {
		    
		    if (parameter.name == "TARGET_VOLUME") {
			    
			    var newVolume = parameter.newValue;
				that.log.debug("Ramp to %s",newVolume);
				that.sonos.rampToVolume("ALARM_RAMP_TYPE",newVolume, function (err, playing) {})
			    

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

