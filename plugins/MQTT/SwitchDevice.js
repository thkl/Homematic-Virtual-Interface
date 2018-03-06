'use strict'

var HomematicDevice;

var SwitchDevice = function(plugin, settings, serial,mqtt_device) {
	
	let that = this
	this.log = plugin.log
	this.plugin = plugin
	this.settings = settings
	this.bridge = this.plugin.bridge
	this.type = settings['type']
	this.serial = serial
	this.mqtt_device = mqtt_device
	this.log.debug("Init Device %s %s",serial,mqtt_device)
	this.hmDevice = this.bridge.initDevice(this.plugin.getName(),serial,this.settings['hmdevice'],serial)  
  
	// this will trigered when a value of a channel was changed by the ccu
  	this.hmDevice.on('device_channel_value_change', function (parameter) {
    	var newValue = parameter.newValue
		var objchannel = that.hmDevice.getChannel(parameter.channel)
		
		Object.keys(that.settings['channels']).forEach(function (channel){
			that.log.debug('Check channel %s vs %s',channel,objchannel.index)

			if (objchannel.index == channel) {
				let chset = that.settings['channels'][channel]
				let dplist = chset['hm_datapoints']
				dplist.forEach(function (dpname) {
					that.log.debug('Check %s vs %s',parameter.name,dpname);
					if (parameter.name === dpname) {
					// new level is in "newValue"
						that.log.debug('Channel %s update with %s', objchannel.index, newValue)
						let dp_config = chset['settings'][dpname]
						if (dp_config) {
							let mqtt_topic = dp_config['mqtt_topic_set']
							mqtt_topic = mqtt_topic.replace('%name%', that.mqtt_device)
							let mqtt_representation_set = dp_config['mqtt_representation_set']
							let strNewValue = ((newValue==true) || (newValue==1)) ? "true" : "false"
							let value = mqtt_representation_set[strNewValue]
							that.log.debug('Nv %s , %s',strNewValue,value);
							that.log.debug('publish %s with payload %s',mqtt_topic,value)
							that.plugin.mqttClient.publish(mqtt_topic , value)
    		    		}
    		    	}
				})
			}
		})
  	})
}

SwitchDevice.prototype.queryState = function() {
	let that = this
	that.log.debug('query status for %s',this.serial)
	Object.keys(that.settings['channels']).forEach(function (channel_index){
		let chset = that.settings['channels'][channel_index]
		let dplist = chset['hm_datapoints']
		dplist.forEach(function (dpname) {
		let dp_config = chset['settings'][dpname]
			if (dp_config) {
				let mqtt_topic_state = dp_config['mqtt_command_getstate']
				if (mqtt_topic_state != undefined) {
					mqtt_topic_state = mqtt_topic_state.replace('%name%', that.mqtt_device)
					if (mqtt_topic_state) {
						let parts = mqtt_topic_state.split('|')
						that.log.debug('mqtt message %s' , mqtt_topic_state)	
						that.plugin.mqttClient.publish(parts[0],parts[1])
					}
				}
			}	
		})
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


SwitchDevice.prototype.parseMqttResponse = function(settings,key,mqtt_topic, mqtt_payloadObject) {
	let that = this
	var result = undefined
	var s_mqtt_topic = settings['mqtt_topic_' + key]
	let s_mqtt_payload = settings['mqtt_payload_' + key]
	let s_mqtt_representation = settings['mqtt_representation_'+ key]
	if (s_mqtt_topic) {
		s_mqtt_topic = s_mqtt_topic.replace('%name%', that.mqtt_device)
		if (mqtt_topic.match(s_mqtt_topic)) {
			var value = mqtt_payloadObject
			let payload_parts = s_mqtt_payload.split('|')
			payload_parts.forEach(function (part){
				if (value != undefined) {
					value = value[part]				
				}
			})
			if (s_mqtt_representation == undefined) {
				result = value		
			} else {
				let d_value = s_mqtt_representation[value]
				result = d_value
			}
		}
	} 
	return result
}

SwitchDevice.prototype.handleMqttMessage = function(topic,payload) {
	let that = this
	this.log.debug('Switch Device MQTT Message %s,%s',topic,payload)
	let topic_parts = topic.split('/')
	var opayload
	try {
		opayload = JSON.parse(payload)
	} catch (e) {
		opayload = payload;
	}
	
	Object.keys(that.settings['channels']).forEach(function (channel_index){

		let chset = that.settings['channels'][channel_index]
		let dplist = chset['hm_datapoints']
		let ctype = chset['hm_channeltype']
		
		dplist.forEach(function (dpname) {

		let dp_config = chset['settings'][dpname]
			if (dp_config) {
				let channel = that.hmDevice.getChannelWithTypeAndIndex(ctype,channel_index)
				
				if (channel) {
					
					let v = that.parseMqttResponse(dp_config,'get',topic,opayload)
					if (v != undefined) {
						that.log.debug("Update channel parameter %s with %s",dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
					
					v = that.parseMqttResponse(dp_config,'getstate',topic,opayload)
					if (v != undefined) {
						that.log.debug("Update channel parameter %s with %s",dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
		
					v = that.parseMqttResponse(dp_config,'state',topic,opayload)
					if (v != undefined) {
						that.log.debug("Update channel parameter %s with %s",dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
				} else {
					that.log.warn("there is no channel with index %s and type %s",channel_index,ctype)
				}
			} else {
				that.log.error("there is no mqtt message handling config for %s",dpname)
			}
		})
	})

	this.bridge.sendMulticallEvents()
 }

module.exports = {
	SwitchDevice : SwitchDevice
}