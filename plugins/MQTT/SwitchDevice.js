'use strict'

var HomematicDevice;

var SwitchDevice = function(plugin, settings, serial,mqtt_device) {
	
	let that = this
	this.log = plugin.log;
	this.plugin = plugin;
	this.settings = settings;
	this.bridge = this.plugin.bridge;
	this.mqtt_device = mqtt_device;
	this.hmDevice = this.bridge.initDevice(this.plugin.getName(),serial,this.settings["hmdevice"],serial)  
  
	// this will trigered when a value of a channel was changed by the ccu
  	this.hmDevice.on('device_channel_value_change', function (parameter) {
    	var newValue = parameter.newValue
		var objchannel = that.hmDevice.getChannel(parameter.channel)
		
		Object.keys(that.settings['channels']).forEach(function (channel){
			that.log.debug('Check channel %s vs %s',channel,objchannel.index)

			if (objchannel.index == channel) {
				that.log.debug('Index found');
				let chset = that.settings['channels'][channel]
				that.log.debug('Check %s vs %s',parameter.name,chset['hm_datapoint_get']);
				if (parameter.name === chset['hm_datapoint_get']) {
					// new level is in "newValue"
					that.log.debug('Channel %s update with %s', objchannel.index, newValue)
					//publish mqtt message
					let mqtt_topic = chset['mqtt_topic_set']
					mqtt_topic = mqtt_topic.replace('%name%', that.mqtt_device)
					let mqtt_representation = chset['mqtt_representation']
					let payload = (newValue ==  true) ? mqtt_representation[0] : mqtt_representation[1]
					that.log.debug('publish %s with payload %s',mqtt_topic,payload);
					that.plugin.mqttClient.publish(mqtt_topic , payload)
    		}
    	}
			
		})
		// sample do something when parameter with name level was changed
  	})
}

SwitchDevice.prototype.getTopicsToSubscribe = function() {
  let that = this
  var result = [];
  this.settings['subscribe'].forEach(function(topic){
	  let ttopic = topic.replace('%name%', that.mqtt_device)
	  that.log.debug('Topic to subscribe %s',ttopic)
	  result.push(ttopic)
  })	
  return result
}

SwitchDevice.prototype.handleMqttMessage = function(topic,payload) {
	let that = this
	this.log.debug('Switch Device MQTT Message %s,%s',topic,payload);
	let topic_parts = topic.split('/')
	
	Object.keys(that.settings['channels']).forEach(function (channel_index){
		
		let chset = that.settings['channels'][channel_index]
		let mqtt_topic_get = chset['mqtt_topic_get']
		mqtt_topic_get = mqtt_topic_get.replace('%name%', that.mqtt_device)
		let ctype = chset['hm_channeltype_set']
		let dpname = chset['hm_datapoint_set']
		
		if (topic.startsWith(mqtt_topic_get)) {
			let mqtt_representation = chset['mqtt_representation']
			let value = (payload==mqtt_representation[0]) ? true:false
			let channel = that.hmDevice.getChannelWithTypeAndIndex(ctype,channel_index)
			if (channel) {
				channel.updateValue(dpname,value,true,true);
			}
		}
    })
	this.bridge.sendMulticallEvents()
 }

module.exports = {
	SwitchDevice : SwitchDevice
}