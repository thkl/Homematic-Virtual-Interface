'use strict'

var HomematicDevice;
const path = require('path')
const xml2js = require('xml2js')
const util = require('util')

var RaumfeldPlayer = function(plugin,_deviceUdn,_deviceName) {
	
	var that = this
	this.log = plugin.log
	this.plugin = plugin
	this.deviceUdn = _deviceUdn
	this.deviceName = _deviceName
	this.bridge = plugin.server.getBridge()
	this.volume_steps = 5
	
	HomematicDevice = this.plugin.server.homematicDevice

	this.hmDevice = new HomematicDevice(this.plugin.getName())
	
	this.serial = 'R_' + this.deviceUdn.substring(5, 12)
	this.log.info('Init RaumfeldPlayer as serial id is %s',this.serial)
	var data = that.bridge.deviceDataWithSerial(this.serial)
	if (data!=undefined) {
  		this.hmDevice.initWithStoredData(data)
  	}
  	
  
  	if (this.hmDevice.initialized === false) {
		  // if not build a new device from template
		  this.hmDevice.initWithType('HM-RC-19_Raumfeld',this.serial)
		  this.hmDevice.serialNumber = this.serial
		  this.bridge.addDevice(this.hmDevice,true)
  	} else {
      // device was initalized from persistent data just add it to the interface
	  this.bridge.addDevice(this.hmDevice,false)
	}
	

	
  	this.hmDevice.on('device_channel_value_change', function(parameter){
		var raumkernel = that.plugin.raumkernel
			
		var newValue = parameter.newValue
		var channel = that.hmDevice.getChannel(parameter.channel)
		
		var zoneRenderer = raumkernel.managerDisposer.deviceManager.getVirtualMediaRenderer(that.deviceUdn)
		var roomRenderer = raumkernel.managerDisposer.deviceManager.getMediaRenderer(that.deviceUdn)
		that.log.debug("Parameter is %s", typeof newValue)
		that.log.debug('Event %s on channel %s',parameter.name,channel.index)
		that.log.debug('try to get media renderer for %s',that.deviceUdn)
		if (zoneRenderer != undefined) {
			that.log.debug('renderer found')
			//that.log.debug('current zone state %s',JSON.stringify(zoneRenderer.rendererState))
			if (parameter.name == 'PRESS_SHORT') {
			
			switch (channel.index) {
						case '1': 
							that.log.debug('send play')
							zoneRenderer.play().then(function(_data){
								that.log.debug('play result %s',_data)
							}).catch(function(_data){
								that.log.error("play error %s",_data)
							})
							
						break
						
						case '2': 
							that.log.debug('send pause')
							zoneRenderer.pause().then(function(_data){
								that.log.debug('pause result %s',_data)
							}).catch(function(_data){
								that.log.error("pause error %s",_data)
							})
						break
						
						case '3': 
							that.log.debug('send stop')
							zoneRenderer.stop().then(function(_data){
								that.log.debug('stop result %s',_data)
							}).catch(function(_data){
								that.log.error("stop error %s",_data)
							})
						break
						
						case '4': 
							that.log.debug('check mute')
							var mute = 0
							roomRenderer.getMute().then(function(_muteNow){
								if (_muteNow == 0) {mute = 1}
								that.log.debug('set mute %s',mute)
								roomRenderer.setMute(mute).then(function(_data){
									that.log.debug('result set mute %s',JSON.stringify(_data))
								}).catch(function(_data){
								
							})
							}).catch(function(_data){
								that.log.error("set mute error %s",_data)
							})
						break
						
						case '5': 
							that.log.debug('send next')
							zoneRenderer.next().then(function(_data){
								that.log.debug('next result %s',_data)
							}).catch(function(_data){
								that.log.error("jump next error %s",_data)
							})
						break
						
						case '6': 
							that.log.debug('send prev')
							zoneRenderer.prev().then(function(_data){
								that.log.debug('prev result %s',_data)
							}).catch(function(_data){
								that.log.error("jump prev error %s",_data)
							})
						break
						
						case '7': 
							that.log.debug('send standby')
							
							roomRenderer.enterManualStandby().then(function(_data){
								that.log.debug('stndby result %s',_data)
								that.isOn = false
							}).catch(function(_data){
								that.log.error("send standby error %s",_data)
							})
						break
						
						case '8': 
							that.log.debug('send leaveStandby')
							roomRenderer.leaveStandby().then(function(_data){
								that.log.debug('leave sndby result %s',_data)
								that.isOn = true
							}).catch(function(_data){
								that.log.error("send wakeup error %s",_data)
							})
						break
						
						case '9': 
							that.log.debug('setp volume down')
							roomRenderer.getVolume().then(function(_data){
								that.log.debug('cur vol %s',_data)
								let vs = 5
								if (that.volume_steps != undefined ) { vs = that.volume_steps }
								var newvol = parseInt(_data) - vs
								if (newvol < 0 ) { newvol = 0}
								that.log.debug('setnewvol %s',newvol)
								roomRenderer.setVolume(newvol).then(function(result) {
									that.log.debug('setvolume result %s',result)
								}).catch(function(_data){
									that.log.error('set volume error %s',_data)
								})
							}).catch(function(_data){
								that.log.error("get vol dn error %s",_data)
							})
						break
						
						case '10': 
							that.log.debug('setp volume up')
							roomRenderer.getVolume().then(function(_data){
								that.log.debug('cur vol %s',_data)
								let vs = 5
								if (that.volume_steps != undefined ) { vs = that.volume_steps }
								var newvol = parseInt(_data) + vs
								if (newvol > 100 ) { newvol = 100}
								that.log.debug('setnewvol %s',newvol)
								roomRenderer.setVolume(newvol).then(function(result) {
									that.log.debug('setvolume result %s',result)
								}).catch(function(_data){
									that.log.error('set volume error %s',_data)
								})
							}).catch(function(_data){
								that.log.error("get vol up error %s",_data)
							})
						break
						
						case '11': 
						
							that.log.debug('toggle power')
						
							if (that.isOn == true) {
								
							roomRenderer.enterManualStandby().then(function(_data){
								that.log.debug('stndby result %s',_data)
								that.isOn = false
							}).catch(function(_data){
								that.log.error("send standby error %s",_data)
							})
								
							} else {
							
							roomRenderer.leaveStandby().then(function(_data){
								that.log.debug('leave sndby result %s',_data)
								that.isOn = true
							}).catch(function(_data){
								that.log.error("send wakeup error %s",_data)
							})
							
							}
						break

					}
			}

			if (parameter.name == 'TARGET_VOLUME') {
			    var newVolume = parseInt(parameter.newValue)
			    that.log.debug('SetVolumeRequest for Single Room %s',newVolume)
			       roomRenderer.setVolume(newVolume).then(function(result) {
						that.log.debug('setvolume result %s',result)
					}).catch(function(_data){
						that.log.error('Volume Rejection %s',_data)
					})
			    
			}

			if (parameter.name == 'PLAYLIST') {
			    var playlist = parameter.newValue
			    that.log.debug('Set Playlist for Zone %s',playlist)
			    
			    zoneRenderer.loadPlaylist(playlist,1).then(function(result) {
					that.log.debug('set playlist result %s',result)
					zoneRenderer.play().then(function(_data){
						that.log.debug('play result %s',_data)
					}).catch(function(_data){
								
					})
				})
			}

	  	} else {
		  	that.log.error('Renderer not found for %s',that.deviceUdn)
	  	}
	})
}


RaumfeldPlayer.prototype.parseDIDL = function (didl) {
  if ((!didl) || (!didl['DIDL-Lite']) || (!util.isArray(didl['DIDL-Lite'].item)) || (!didl['DIDL-Lite'].item[0])) {
	return {};
  }
  var item = didl['DIDL-Lite'].item[0]
  return {
    title: util.isArray(item['dc:title']) ? item['dc:title'][0] : null,
    artist: util.isArray(item['upnp:artist']) ? item['upnp:artist'][0] : null,
    album: util.isArray(item['upnp:album']) ? item['upnp:album'][0] : null,
    albumArtURI: util.isArray(item['upnp:albumArtURI']) ? item['upnp:albumArtURI'][0] : null
  }
}


RaumfeldPlayer.prototype.parseMetadata = function (metadata) {
   var that = this 
   this.log.debug('Try to parse Metadata')
   let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY','19')
   if (channel) {

	new xml2js.Parser().parseString(metadata , function (err, data) {
		that.log.debug('DIDL Lite %s',JSON.stringify(data))
	  	let track  = that.parseDIDL(data);
	  	that.log.debug('Track parsed : %s',JSON.stringify(track))
	  	channel.updateValue('TITLE',(track.title != undefined) ? track.title : "",true,true)
	  	channel.updateValue('ARTIST',(track.artist != undefined) ? track.artist : "",true,true)
	  	channel.updateValue('ALBUMARTURL',(track.albumArtURI !=undefined) ? track.albumArtURI :track.albumArtURI ,true,true)
   	});
   
   }
}


RaumfeldPlayer.prototype.update = function (_key,_newState) {
   	
   	let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY','19')
	if (channel) {
	this.log.debug("Type %s",(typeof _newState))
	if ((typeof _newState === 'string' || _newState instanceof String) && (_newState.length > 0)) {
   	
   	switch (_key) {
		case 'PowerState': 
		  channel.updateValue('POWERSTATE',_newState,true,true)
		  if ((_newState == 'ACTIVE') || (_newState == 'IDLE')) {
			  this.isOn = true
		  } else {
			  this.isOn = false
		  }
		break
 
 		case 'transportState': 
		  channel.updateValue('PLAYMODE',_newState,true,true)
		break
		
		case 'Volume':
	  	  channel.updateValue('CURRENT_VOLUME',_newState.toString(),true,true);
		break
		
		case 'CurrentTrackMetaData':
		  this.parseMetadata(_newState)
		
		break;
    }
	}
	}
}

module.exports =  RaumfeldPlayer

