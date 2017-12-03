'use strict'

var HomematicDevice;

var TradfriDevice = function(plugin,light,serialprefix) {


		var that = this
		this.log = plugin.log
		this.bridge = plugin.server.getBridge()
		this.plugin = plugin
		this.light = light
		
		HomematicDevice = plugin.server.homematicDevice
		
		this.id = serialprefix
		this.onTime = 0
		this.lastLevel = 0
		this.curLevel = 0
		this.transitiontime = 0.5
		this.hmDevice = new HomematicDevice(this.plugin.getName())
		this.serial = 'Tradfri'+this.id
		this.ikeaName = light._accessory.name
		this.ikeaType = light._accessory.deviceInfo.modelNumber
		this.log.debug('Setup new Tradfri %s',this.serial)
		this.test = 0
		
		var data = this.bridge.deviceDataWithSerial(this.serial)
		if (data!=undefined) {
			this.hmDevice.initWithStoredData(data)
		}
		
		if (this.hmDevice.initialized === false) {
			this.hmDevice.initWithType('VIR-LG-RGBW-DIM', this.serial)
			this.hmDevice.serialNumber = this.serial
			this.bridge.addDevice(this.hmDevice,true)
		} else {
			this.bridge.addDevice(this.hmDevice,false)
		}

		this.hmDevice.on('device_channel_value_change', function(parameter){
			var newValue = parameter.newValue
			var channel = that.hmDevice.getChannel(parameter.channel)

			if (parameter.name == 'INSTALL_TEST') {
				that.setLevel(1)
				setTimeout(function(){
					that.setLevel(0)
					channel.endUpdating('INSTALL_TEST')
				}, 1000)
	      	}

	      if (parameter.name == 'LEVEL') {
	       that.setLevel(newValue);
		   if ((that.onTime > 0) && (newValue>0)) {
		    setTimeout(function() {that.setLevel(0)}, that.onTime * 1000)
	       }
	       // reset the transition and on time 
	       that.transitiontime = 0.5
	       that.onTime = 0
	       if (newValue > 0) {
		       that.lastLevel = newValue
	       }
	     }


		 if (parameter.name == 'OLD_LEVEL') {
	       if (newValue==true) {
		      if (that.lastLevel == 0) {
			      that.lastLevel = 1
		      }
		      that.setLevel(that.lastLevel) 
	       
	       }
	       
	     }

	    if ((parameter.name == 'RAMP_TIME') && (channel.index == '1')) {
		  that.transitiontime = newValue
		}

	    if ((parameter.name == "ON_TIME") && (channel.index == '1')) {
		  that.onTime = newValue
		}

	    if (parameter.name == 'WHITE') {
		  that.setWhite(newValue)
	    }

		if (parameter.name == 'RGBW') {
	       that.setColor(newValue);
	    }
    })

	}
	
	TradfriDevice.prototype.setColor = function(newColor) {
	    var that = this
	    if (this.light.spectrum === 'rgb') {
	    var co_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (co_channel != undefined) {
			var regex = /(\s*[0-9]{1,3}),(\s*[0-9]{1,3}),(\s*[0-9]{1,3})/
			var result = newColor.match(regex);
			var r = parseInt(result[1].trim()).toString(16);
			var g = parseInt(result[2].trim()).toString(16);
			var b = parseInt(result[3].trim()).toString(16);
			let hsv = this.RGBtoHSV(r,g,b)
			this.light.setHue(hsv.h,this.transitiontime).then().catch((e) => {
				that.log.error('set hue error %s',e)
			})
			this.light.setSaturation(hsv.s,this.transitiontime).then().catch((e) => {
				that.log.error('set sat error %s',e)
			})
			this.log.debug('Color %s command %s',JSON.stringify(hsv))
		}
		} 
	}

    TradfriDevice.prototype.pad = function (n, width, z) {
		z = z || '0';
		n = n + '';
		return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
	}

	TradfriDevice.prototype.setWhite = function(newTemp) {
	    
	    if (this.light.spectrum === 'white') {
		var that = this
	    var co_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (co_channel != undefined) {
			// White bulbs have  fixed color s
			this.log.info(newTemp)
			if (newTemp == 6500) {
				this.light.setColor('f5faf6', this.transitionTime)
			}
			if (newTemp == 4500) {
				this.light.setColor('f1e0b5', this.transitionTime)
			}
			if (newTemp == 2000) {
				this.light.setColor('efd275', this.transitionTime)
			}
		}
		}
	}

	
	TradfriDevice.prototype.setLevel = function(newLevel) {
	    var di_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (di_channel != undefined) {
			this.curLevel = newLevel
			this.light.operateLight({dimmer: (newLevel * 100)}, this.transitiontime)
			di_channel.startUpdating('LEVEL');
			di_channel.updateValue('LEVEL',newLevel)
			di_channel.endUpdating('LEVEL')
		}
	}

	TradfriDevice.prototype.updateLevel = function(isOn, newLevel) {
		var di_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (di_channel != undefined) {
			if (isOn == false) {
				di_channel.updateValue('LEVEL',0,true)
			} else {
				di_channel.updateValue('LEVEL',newLevel,true)
			}
		}
	}
	
	TradfriDevice.prototype.updateWhite = function(newColor) {
		if (this.light.spectrum === 'white') {
			var di_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
			var newColTemp = '6500'
	    
			if (newColor == 'f1e0b5') {
				newColTemp = '4500'
			}
	    
			if (newColor == 'efd275') {
		    	newColTemp = '2000'
	    	}
	    
			di_channel.updateValue('WHITE', newColTemp,true,false)
		}
	}
	
	TradfriDevice.prototype.RGBtoHSV = function(r, g, b) {
   		if (arguments.length === 1) {
   		 	g = r.g, b = r.b, r = r.r;
    	}
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return {
        h: h,
        s: s,
        v: v
    };
	}

	module.exports = {
	  TradfriDevice : TradfriDevice
	}
