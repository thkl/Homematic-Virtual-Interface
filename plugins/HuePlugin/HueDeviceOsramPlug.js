	'use strict'

	const LightState = require('node-hue-api').v3.lightStates.LightState
	var HomematicDevice
	var HueDeviceOsramPlug = function(plugin, hueApi, light, serialprefix) {

	    var that = this
	    this.api = hueApi
	    this.log = plugin.log
	    this.bridge = plugin.server.getBridge()
	    this.plugin = plugin

	    HomematicDevice = plugin.server.homematicDevice

	    this.lightId = light["id"]
	    this.isGroup = (light["uniqueid"] == undefined)
	    this.transitiontime = 4 // Default Hue
	    this.onTime = 0
	    this.lastLevel = 0

	    this.log.debug("Setup new Osram Plug Bridged Device %s", serialprefix + this.lightId)


	    this.hmDevice = new HomematicDevice(this.plugin.name)
	    this.hmDevice = this.bridge.initDevice(this.plugin.name, serial, "HM-LC-Sw1-Pl", serialprefix + this.lightId)
	    this.hmDevice.firmware = light["swversion"]

	    this.hmDevice.on('device_channel_value_change', function(parameter) {

	        that.log.debug("Value was changed " + JSON.stringify(parameter))
	        var newValue = parameter.newValue

	        var channel = that.hmDevice.getChannel(parameter.channel)

	        if (parameter.name == "STATE") {
	            that.setState(newValue)
	            if ((that.onTime > 0) && (newValue == true)) {
	                setTimeout(function() {
	                    that.setState(false)
	                }, that.onTime * 1000)
	            }
	            // reset the transition and on time 
	            that.transitiontime = 4
	            that.onTime = 0
	            if (newValue > 0) {
	                that.lastLevel = newValue
	            }
	        }

	        if ((parameter.name == "ON_TIME") && (channel.index == "1")) {
	            that.onTime = newValue
	        }

	    })

	    this.updateTimer = setTimeout(function() {
	        that.refreshDevice()
	    }, 1000)

	}

	HueDeviceOsramPlug.prototype.reload = function() {

	}

	HueDeviceOsramPlug.prototype.setState = function(newState) {
	    var that = this
	    var sw_channel = that.hmDevice.getChannelWithTypeAndIndex("SWITCH", "1")
	    sw_channel.startUpdating("STATE")
	    sw_channel.updateValue("STATE", newState)

	    var nState = new LightState().transitiontime()
	    if (newState === true) {
	        nState.on()
	    } else {
	        nState.off()
	    }
	    this.api.lights.setLightState(this.lightId, nState).then(function(result) {
	        if (di_channel != undefined)  {
	            sw_channel.endUpdating("STATE")
	        }
	    })
	}

	HueDeviceOsramPlug.prototype.refreshDevice = function() {
	    let that = this
	    this._refreshDevice()
	    this.updateTimer = setTimeout(function() {
	        that.refreshDevice()
	    }, this.refresh)
	}

	HueDeviceOsramPlug.prototype._refreshDevice = function() {
	    var that = this
	    this.api.lights.getLightState(that.lightId).then(function(lightState) {
	        let sw_channel = that.hmDevice.getChannelWithTypeAndIndex("SWITCH", "1")
	        if (sw_channel != undefined) {
	            if (lightState.on === true)  {
	                sw_channel.updateValue("STATE", 1, true)
	            } else {
	                di_channel.updateValue("STATE", 0, true)
	            }
	        }
	    })
	}

	HueDeviceOsramPlug.prototype.refreshLight = function() {
	    let that = this
	    setTimeout(function() {
	        that._refreshDevice()
	    }, Math.random * 1000)
	}

	module.exports = {
	    HueDeviceOsramPlug: HueDeviceOsramPlug
	}