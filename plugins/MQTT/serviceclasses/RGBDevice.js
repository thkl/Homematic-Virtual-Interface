'use strict'

var HomematicDevice;

var RGBDevice = function(plugin, settings, serial,mqtt_device) {
	
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
    	if (typeof newValue != 'string') {
	    	that.log.debug('Channel %s Value is a Object %s',parameter.channel,JSON.stringify(newValue))

	    	if (newValue.explicitDouble) {
		    	
		    	newValue = newValue.explicitDouble
		    	that.log.debug('Change value to %s',JSON.stringify(newValue))
	    	} else {
		    	that.log.debug('Key not found')

	    	}
	    }
	    
		var objchannel = that.hmDevice.getChannel(parameter.channel)
		that.log.debug('Channel is %s',objchannel)
		
		Object.keys(that.settings['channels']).forEach(function (channel){
			that.log.debug('Check channel %s vs %s',channel,objchannel.index)

			if (objchannel.index == channel) {
				let chset = that.settings['channels'][channel]
				let dplist = chset['hm_datapoints']
				dplist.forEach(function (dpname) {
					that.log.debug('Check %s vs %s',parameter.name,dpname);
					if (parameter.name === dpname) {
						that.log.debug('Channel %s update with %s', objchannel.index, newValue)
						let dp_config = chset['settings'][dpname]
						if (dp_config) {
							
							// Check if we have a special value
							that.log.debug('Check mqtt_topic_set_special | %s',String(newValue));
							if ((dp_config['mqtt_topic_set_special'] && (dp_config['mqtt_topic_set_special'][String(newValue)]))) {
								that.log.debug('mqtt_topic_set_special found')
								let tp = dp_config['mqtt_topic_set_special'][String(newValue)]['topic'];
								let pl = dp_config['mqtt_topic_set_special'][String(newValue)]['payload'];
								if ((tp) && (pl)) {
									that.log.debug('Topic and Payload found')
									tp = tp.replace('%name%', that.mqtt_device)
									that.log.debug('publish %s with payload %s',tp,pl)
									that.plugin.mqttClient.publish(tp , pl)
								} else {
									that.log.error('missing topic (%s) or payload (%s)',tp,pl)
								}							
								
							} else {
								that.log.debug('Falling to mqtt_topic_set');
								let mqtt_topic = dp_config['mqtt_topic_set']
								mqtt_topic = mqtt_topic.replace('%name%', that.mqtt_device)
								let value = that.convertMQTTValues(objchannel,dpname,newValue)
								that.log.debug('Nv %s , %s',newValue,value);
								that.log.debug('publish %s with payload %s',mqtt_topic,value)
								that.plugin.mqttClient.publish(mqtt_topic , value)
							}
    		    		}
    		    	} 
				})
			}
		})
  	})
}

RGBDevice.prototype.queryState = function() {
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


RGBDevice.prototype.getTopicsToSubscribe = function() {
  let that = this
  var result = []
  this.settings['subscribe'].forEach(function(topic){
	  let ttopic = topic.replace('%name%', that.mqtt_device)
	  result.push(ttopic)
  })	
  return result
}


RGBDevice.prototype.parseMqttResponse = function(settings,key,mqtt_topic, mqtt_payloadObject) {
	let that = this

	var result = undefined
	
	if ((mqtt_payloadObject === undefined) || (mqtt_payloadObject=== '')) {
		that.log.debug('empty response parseMqttResponse Key %s , Topic %s Payload %s',key,mqtt_topic,JSON.stringify(mqtt_payloadObject))
		return result
	}


	var s_mqtt_topic = settings['mqtt_topic_' + key]
	let s_mqtt_payload = settings['mqtt_payload_' + key]
	let s_mqtt_representation = settings['mqtt_representation_'+ key]
	if (s_mqtt_topic) {
		s_mqtt_topic = s_mqtt_topic.replace('%name%', that.mqtt_device)
		if (mqtt_topic.match(s_mqtt_topic)) {
			that.log.debug('Topic %s matches search %s',mqtt_topic,s_mqtt_topic)

			var value = mqtt_payloadObject
			
			if (typeof value != 'string') {
				that.log.debug('value %s is an Object',JSON.stringify(value))
				
					let payload_parts = s_mqtt_payload.split('|')
					that.log.debug('Parts %s',JSON.stringify(payload_parts))
					payload_parts.forEach(function (part){
					if (value != undefined) {
						value = value[part]				
					}
					that.log.debug('newvalue is %s',value)
				})
			} else {
				try {
			    if ((value !== undefined) && (value !== '')) {
				let v = JSON.parse(value);
				that.log.debug('value a string try JSONize %s',v)
				that.log.debug('value is %s',typeof value)
				if (v) {
					let payload_parts = s_mqtt_payload.split('|')
					payload_parts.forEach(function (part){
					if (value != undefined) {
						value = value[part]				
					}
					})
				}
				
				} else {
					that.log.debug("Value is empty root is %s  with payload filter %s",mqtt_payloadObject,s_mqtt_payload)
				}
				
				}
				 catch (e) {
					that.log.error("JSON Parsing Error (%s)",value);
				}
				
			} 
			if (s_mqtt_representation == undefined) {
				result = value		
			} else {
				that.log.debug('representations : %s',JSON.stringify(s_mqtt_representation))
				that.log.debug('try to match  : %s',JSON.stringify(value))
				let d_value = s_mqtt_representation[value]
				result = d_value
			}
		} else {
		   that.log.debug('Topic %s not match search %s',mqtt_topic,s_mqtt_topic)
		}
	} else {
		that.log.debug('no mqtt_topic_%s found for message %s',key, mqtt_topic)
	} 
	that.log.debug('result is %s',JSON.stringify(result))
	return result
}

RGBDevice.prototype.convertChannelValues = function(channel,value) {
	var result = value;
	this.log.debug("Convert Value %s for %s ",value,channel.type)
	switch (channel.type) {
		
		case "DIMMER" : 
		   result = (parseFloat(value) / 255);
		  break
		  
		case "RGBW_COLOR" :
		  // Value is a Object eject the data
		  {
		  	// Special
		  if ((value.r == 255) && (value.g == 255) && (value.b == 255)) {
			  return 200;
		  }

		  this.log.debug("RGB Object is %s",JSON.stringify(value))
		  let r = value.r
		  let g = value.g
		  let b = value.b
		  let hsv = this.RGBtoHSV(r,g,b)
		  this.log.debug("HSV Object is %s",JSON.stringify(hsv))
		  result = (hsv.h * 200).toFixed()
		  }
		  break
		
	}
	return result;
}

RGBDevice.prototype.convertMQTTValues = function(channel,dpname,value) {
	var result = value;
	this.log.debug("Convert to mqtt Value %s for %s Datapoint %s",value,channel.type,dpname)

	switch (channel.type) {
		
		case "DIMMER" : 
		   result = (value * 255).toFixed().toString();
		  break
		case "RGBW_COLOR"  :
		{
			
		   if (dpname == "COLOR") {
			   
			if (value == 200) {
			   result = "255,255,255,2"
			} else {
				// first convert HM to HSV
				let h = (value/199)
				let rgb = this.HSVtoRGB(h,1,1)
				result = String(rgb.r) + "," + String(rgb.g) + "," + String(rgb.b) + ",2"
			}
		   }
		   
		   if (dpname == "USER_COLOR") {
			   // get ACT_HSV_COLOR_VALUE_STORE
			   let action = JSON.parse(value.replace(new RegExp("'", 'g'), "\""));
			   var h = action.ACT_HSV_COLOR_VALUE_STORE
			   this.log.debug("Found User Color just need ACT_HSV_COLOR_VALUE_STORE - %s",h)
			   if (h !== undefined) {
				if (value == 200) {
					result = "255,255,255,2"
				} else {
					h = (h/199)
					let rgb = this.HSVtoRGB(h,1,1)
					result = String(rgb.r) + "," + String(rgb.g) + "," + String(rgb.b) + ",2"
				}
			   }
		   }
		}
		
	}
	this.log.debug("result is %s",result)
	return result;
}


RGBDevice.prototype.handleMqttMessage = function(topic,payload) {
	let that = this
	this.log.debug('RGB MQTT Message %s,%s',topic,payload)
	let topic_parts = topic.split('/')
	var opayload
	var v
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
					
					v = that.parseMqttResponse(dp_config,'get',topic,opayload)
					if (v != undefined) {
						v = that.convertChannelValues(channel,v)
						that.log.debug('Update channel parameter %s with %s',dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
					
					v = that.parseMqttResponse(dp_config,'getstate',topic,opayload)
					if (v != undefined) {
						v = that.convertChannelValues(channel,v)
						that.log.debug('Update channel parameter %s with %s',dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
		
					v = that.parseMqttResponse(dp_config,'state',topic,opayload)
					if (v != undefined) {
						v = that.convertChannelValues(channel,v)
						that.log.debug('Update channel parameter %s with %s',dpname,v)
						channel.updateValue(dpname,v,true,true)
					}
				} else {
					that.log.warn('there is no channel with index %s and type %s',channel_index,ctype)
				}
			} else {
				that.log.error('there is no mqtt message handling config for %s',dpname)
			}
		})
	})

	this.bridge.sendMulticallEvents()
 }
 
 
 RGBDevice.prototype.HSVtoRGB = function(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
}

RGBDevice.prototype.RGBtoHSV = function(r, g, b) {
    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    this.log.debug("HSV Convert %s , %s , %s",r,g,b)

    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

	this.log.debug("max is %s",max)

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

	this.log.debug("result is %s , %s , %s",h,s,v)
    return {
        h: h,
        s: s,
        v: v
    };
}

module.exports = RGBDevice