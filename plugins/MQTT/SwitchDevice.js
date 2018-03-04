'use strict'

var HomematicDevice;

var SwitchDevice = function(plugin, settings, serial,mqtt_device) {
	
	let that = this
	this.log = plugin.log
	this.plugin = plugin
	this.settings = settings
	this.bridge = this.plugin.bridge
	this.type = 'SwitchDevice'
	this.serial = serial
	this.mqtt_device = mqtt_device
	this.hmDevice = this.bridge.initDevice(this.plugin.getName(),serial,this.settings['hmdevice'],serial)  
  
	// this will trigered when a value of a channel was changed by the ccu
  	this.hmDevice.on('device_channel_value_change', function (parameter) {
    	var newValue = parameter.newValue
		var objchannel = that.hmDevice.getChannel(parameter.channel)
		
		Object.keys(that.settings['channels']).forEach(function (channel){
			that.log.debug('Check channel %s vs %s',channel,objchannel.index)

			if (objchannel.index == channel) {
				let chset = that.settings['channels'][channel]
				that.log.debug('Check %s vs %s',parameter.name,chset['hm_datapoint_get']);
				if (parameter.name === chset['hm_datapoint_get']) {
					// new level is in "newValue"
					that.log.debug('Channel %s update with %s', objchannel.index, newValue)
					//publish mqtt message
					let mqtt_topic = chset['mqtt_topic_set']
					mqtt_topic = mqtt_topic.replace('%name%', that.mqtt_device)
					let mqtt_representation_set = chset['mqtt_representation_set']
					let strNewValue = ((newValue==true) || (newValue==1)) ? "true" : "false"
					let value = mqtt_representation_set[strNewValue]
					that.log.debug('Nv %s , %s',strNewValue,value);
					
					that.log.debug('publish %s with payload %s',mqtt_topic,value)
					that.plugin.mqttClient.publish(mqtt_topic , value)
    		}
    	}
			
		})
  	})
}

SwitchDevice.prototype.queryState = function() {
	let that = this
	that.log.debug('query status for %s',this.serial)
	Object.keys(that.settings['channels']).forEach(function (channel_index){
		let chset = that.settings['channels'][channel_index]
		let mqtt_topic_state = chset['mqtt_topic_getstate']
		mqtt_topic_state = mqtt_topic_state.replace('%name%', that.mqtt_device)
		if (mqtt_topic_state) {
		   that.log.debug('mqtt message %s' , mqtt_topic_state)	
		   that.plugin.mqttClient.publish(mqtt_topic_state)
		} else {
			that.log.warn('No status query topic found for channel %s',channel_index)
		}	
	})
}	


SwitchDevice.prototype.getTopicsToSubscribe = function() {
  let that = this
  var result = []
  this.settings['subscribe'].forEach(function(topic){
	  let ttopic = topic.replace('%name%', that.mqtt_device)
	  result.push(ttopic)
  })	
  return result
}

SwitchDevice.prototype.handleMqttMessage = function(topic,payload) {
	let that = this
	this.log.debug('Switch Device MQTT Message %s,%s',topic,payload)
	let topic_parts = topic.split('/')
	let opayload = {};
	try {
		opayload = JSON.parse(payload)
	} catch (e) {
		
	}
	
	Object.keys(that.settings['channels']).forEach(function (channel_index){
		
		let chset = that.settings['channels'][channel_index]
		let mqtt_topic_get = chset['mqtt_topic_get'].replace('%name%', that.mqtt_device)
		let mqtt_topic_state = chset['mqtt_topic_state'].replace('%name%', that.mqtt_device)
		let mqtt_payload_state = chset['mqtt_payload_state']
		let mqtt_payload_get = chset['mqtt_payload_get']
		
		let ctype = chset['hm_channeltype_set']
		let dpname = chset['hm_datapoint_set']
		
		// Check Get Message
		if (mqtt_topic_get) {
		if (topic.match(mqtt_topic_get)) {
			let stateValue = opayload[mqtt_payload_get]
			if (stateValue) {
				let mqtt_representation_get = chset['mqtt_representation_get']
				let value = mqtt_representation_get[stateValue]
				let channel = that.hmDevice.getChannelWithTypeAndIndex(ctype,channel_index)
				if (channel) {
					channel.updateValue(dpname,value,true,true)
				}
			}
		}
		}
		
		// Check State Message
		if (mqtt_payload_state) {
		if (topic.match(mqtt_topic_state)) {
			let stateValue = opayload[mqtt_payload_state]
			if (stateValue) {
				let mqtt_representation_state = chset['mqtt_representation_state']
				let value = mqtt_representation_state[stateValue]
				let channel = that.hmDevice.getChannelWithTypeAndIndex(ctype,channel_index)
				if (channel) {
					channel.updateValue(dpname,value,true,true)
				}
			}
		}
		}
		
		// Check State rsponse Message
		let mqtt_topic_getstate_response = chset['mqtt_topic_getstate_response'].replace('%name%', that.mqtt_device)
		let mqtt_payload_getstate_response = chset['mqtt_payload_getstate_response']
		
		if (mqtt_topic_getstate_response) {
			
		if (topic.match(mqtt_topic_getstate_response)) {
			let stateValue = opayload[mqtt_payload_getstate_response]
			if (stateValue) {
				let mqtt_representation_getstate_response = chset['mqtt_representation_getstate_response']
				let value = mqtt_representation_getstate_response[stateValue]
				let channel = that.hmDevice.getChannelWithTypeAndIndex(ctype,channel_index)
				if (channel) {
					channel.updateValue(dpname,value,true,true)
				}
			}
		}
		}


    })
    
	this.bridge.sendMulticallEvents()
	
	
 }

module.exports = {
	SwitchDevice : SwitchDevice
}