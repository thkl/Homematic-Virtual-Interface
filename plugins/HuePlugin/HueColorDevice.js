"use strict"
const LightState = require('node-hue-api').v3.lightStates.LightState
const GroupLightState = require('node-hue-api').v3.model.lightStates.GroupLightState
const EventEmitter = require('events')
const util = require('util')

var HomematicDevice

var HueColorDevice = function(plugin, hueApi, light, serialprefix) {

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
    this.bri = 0

    this.config = plugin.server.configuration
    this.reportFaults = false

    if (this.config != undefined) {
        this.log.debug("Config is valid")
        this.reportFaults = this.config.getValueForPluginWithDefault(this.plugin.name, "reportFaults", false)
    }

    this.log.debug("Setup new HUE Bridged Device %s", serialprefix + this.lightId)
    this.reload()
    var serial = light["uniqueid"]
    this.hmDevice = this.bridge.initDevice(this.plugin.name, serial, "HM-LC-RGBW-WM", serialprefix + this.lightId)
    this.hmDevice.firmware = light["swversion"]

    this.hmDevice.on('device_channel_install_test', function(parameter) {
        that.alert()
        var channel = that.hmDevice.getChannel(parameter.channel)
        channel.endUpdating("INSTALL_TEST")
    })

    this.hmDevice.on('device_channel_value_change', function(parameter) {
        var newValue = parameter.newValue
        var channel = that.hmDevice.getChannel(parameter.channel)
        if (parameter.name == "PROGRAM") {
            switch (newValue) {
                case 0:
                    that.effect("none")
                    break
                case 1:
                case 2:
                case 3:
                    that.effect("colorloop")
                    break
                case 4:
                    that.alert()
                    break
            }
            channel.endUpdating("PROGRAM")
        }


        // {'ACT_COLOR_PROGRAM_STORE':0,'ACT_BRIGHTNESS_STORE':200,'RAMP_TIME_STORE':0.5,'ON_TIME_STORE':0,'ACT_MIN_BORDER_STORE':0,'ACT_MAX_BORDER_STORE':34}
        if (parameter.name == "USER_PROGRAM") {
            // Thats a channel action JSON with ' needs to replaced
            let action = JSON.parse(newValue.replace(new RegExp("'", 'g'), "\""))
            if ((action != undefined) && (action['ACT_BRIGHTNESS_STORE'] != undefined)) {
                that.log.debug("User Program %s", action)
                that.transitiontime = action['RAMP_TIME_STORE'] * 10
                that.onTime = action['ON_TIME_STORE']
                that.internalSetLevel(action['ACT_BRIGHTNESS_STORE'] / 200)
                that.transitiontime = action['RAMP_TIME_STORE'] * 10
                that.setColor(action['ACT_MAX_BORDER_STORE'])
            }
        }


        //  {'ACT_HSV_COLOR_VALUE_STORE':133,'ACT_BRIGHTNESS_STORE':200,'RAMP_TIME_STORE':0.5,'ON_TIME_STORE':0}
        if (parameter.name == "USER_COLOR") {
            that.log.debug("Channel 2 Channel action", newValue)

            // Thats a channel action JSON with ' needs to replaced
            let action = JSON.parse(newValue.replace(new RegExp("'", 'g'), "\""))
            if ((action != undefined) && (action['ACT_BRIGHTNESS_STORE'] != undefined)) {
                that.log.debug("User Color %s", action)
                that.transitiontime = action['RAMP_TIME_STORE'] * 10
                that.onTime = action['ON_TIME_STORE']
                that.internalSetLevel(action['ACT_BRIGHTNESS_STORE'] / 200)
                that.transitiontime = action['RAMP_TIME_STORE'] * 10
                that.setColor(action['ACT_HSV_COLOR_VALUE_STORE'])
            } else {
                that.log.debug("action is missing or ACT_BRIGHTNESS_STORE value not set")
            }
        }


        if (parameter.name == "LEVEL") {
            that.internalSetLevel(newValue)
        }


        if (parameter.name == "OLD_LEVEL") {
            if (newValue == true)  {
                if (that.lastLevel == 0) {
                    that.lastLevel = 1
                }
                that.setLevel(that.lastLevel)
            }
        }

        if ((parameter.name == "RAMP_TIME") && (channel.index == "1")) {
            that.transitiontime = newValue * 10
        }

        if ((parameter.name == "ON_TIME") && (channel.index == "1")) {
            that.onTime = newValue
        }

        if (parameter.name == "COLOR") {
            that.setColor(newValue)
        }

        if (parameter.name == "SATURATION") {
            that.setSaturation(newValue)
        }
    })
    EventEmitter.call(this)
}

util.inherits(HueColorDevice, EventEmitter)


HueColorDevice.prototype.reload = function() {
    if (this.config != undefined) {
        this.log.debug("Reload Lamp Configuration ...")
        this.refresh = (this.config.getValueForPluginWithDefault(this.plugin.name, "refresh", 60)) * 1000
        this.log.debug("Refresh Rate is %s ms", this.refresh)
    }
}

HueColorDevice.prototype.alert = function() {
    this.log.debug('Alerting')
    if (this.isGroup == true) {
        this.api.groups.setGroupState(this.lightId, {
            "alert": "lselect"
        }, function(err, result) {})
    } else {
        this.api.lights.setLightState(this.lightId, {
            "alert": "lselect"
        }, function(err, result) {})
    }
}


HueColorDevice.prototype.effect = function(effectname) {
    if (this.isGroup == true) {
        this.api.groups.setGroupState(this.lightId, {
            "effect": effectname
        }, function(err, result) {})
    } else {
        this.api.lights.setLightState(this.lightId, {
            "effect": effectname
        }, function(err, result) {})
    }
}


HueColorDevice.prototype.setColor = function(newColor) {
    var that = this
    this.hue = 0
    this.sat = 0


    this.emit('direct_light_event', this)

    var co_channel = that.hmDevice.getChannelWithTypeAndIndex("RGBW_COLOR", "2")

    if (newColor == 200) {
        // SpeZiale
        var white = co_channel.getParamsetValueWithDefault("MASTER", "WHITE_HUE_VALUE", 39609)
        this.sat = co_channel.getParamsetValueWithDefault("MASTER", "DEFAULT_SATURATION", 128)
        this.hue = white
        if (this.sat > 254) {
            this.sat = 254
        }
    } else {
        this.hue = (newColor / 199) * 65535
        this.sat = 254
    }

    this.log.debug("Hue Value set to " + JSON.stringify(newState))

    if (co_channel != undefined)  {
        co_channel.startUpdating("COLOR")
    }

    if (that.isGroup == true) {

        var newState = new GroupLightState().transitiontime(this.transitiontime)
        newState.sat(this.at)
        newState.bri(this.bri)
        newState.hue(this.hue)


        this.api.groups.getGroupState(that.lightId).then(function(groupState) {
            if (groupState.on === true) {
                that.api.groups.setGroupState(that.lightId, newState).then(function(result) {
                    if (co_channel != undefined)  {
                        co_channel.endUpdating("COLOR")
                    }
                })
            }
        })
    } else {

        var newState = new LightState().transitiontime(this.transitiontime)
        newState.sat(this.sat)
        newState.bri(this.bri)
        newState.hue(this.hue)
        this.api.lights.getLightState(that.lightId).then(function(lightState) {
            if (lightState.on === true) {
                that.api.lights.setLightState(that.lightId, newState).then(function(result) {
                    if (co_channel != undefined)  {
                        co_channel.endUpdating("COLOR")
                    }
                })
            }
        })
    }
}

HueColorDevice.prototype.internalSetLevel = function(newValue) {
    let that = this
    that.setLevel(newValue)
    if ((that.onTime > 0) && (newValue > 0)) {
        setTimeout(function() {
            that.setLevel(0)
        }, that.onTime * 1000)
    }
    // reset the transition and on time 
    that.transitiontime = 4
    that.onTime = 0
    if (newValue > 0) {
        that.lastLevel = newValue
    }
}

HueColorDevice.prototype.setSaturation = function(newSaturation) {
    var that = this
    var newState = {
        "sat": newSaturation
    }
    this.emit('direct_light_event', this)

    this.log.debug("Sat Value set to " + JSON.stringify(newState))
    var co_channel = that.hmDevice.getChannelWithTypeAndIndex("RGBW_COLOR", "2")

    if (co_channel != undefined)  {
        co_channel.startUpdating("SATURATION")
    }

    if (that.isGroup == true) {

        that.api.setGroupLightState(that.lightId, newState, function(err, result) {
            if (co_channel != undefined)  {
                co_channel.endUpdating("SATURATION")
            }
        })

    } else {
        that.api.setLightState(that.lightId, newState, function(err, result) {

            if (co_channel != undefined)  {
                co_channel.endUpdating("SATURATION")
            }
        })
    }
}


HueColorDevice.prototype.setLevel = function(newLevel) {
    let that = this
    this.emit('direct_light_event', this)
    this.log.debug('setLevel %s', newLevel)
    var di_channel = this.hmDevice.getChannelWithTypeAndIndex("DIMMER", "1")
    di_channel.startUpdating("LEVEL")
    di_channel.updateValue("LEVEL", newLevel)

    if (this.isGroup == true) {

        var newState = new GroupLightState().transitiontime(this.transitiontime)
        this.bri = (newLevel / 1) * 254
        if (this.bri < 1) {
            this.bri = 1
            newState.off()
        } else {
            newState.on(true)
            newState.bri(this.bri)
            newState.sat(this.sat)
            newState.hue(this.hue)
        }

        this.api.groups.setGroupState(this.lightId, newState).then(function(result) {
            if (di_channel != undefined)  {
                di_channel.endUpdating("LEVEL")
            }
        })

    } else {
        var newState = new LightState().transitiontime(this.transitiontime)
        this.bri = (newLevel / 1) * 254
        if (this.bri < 1) {
            this.bri = 1
            newState.off()
        } else {
            newState.on(true)
            newState.bri(this.bri)
            newState.sat(this.sat)
            newState.hue(this.hue)
        }

        this.api.lights.setLightState(this.lightId, newState).then(function(result) {
            if (di_channel != undefined)  {
                di_channel.endUpdating("LEVEL")
            }
        })

    }
}


HueColorDevice.prototype.setLightData = function(lightData) {
    this.api.lights.setLightState(this.lightId, lightData, function(err, result) {
        // HM SEND
    })
}

HueColorDevice.prototype.refreshDevice = function() {
    let that = this
    this.updateTimer = setTimeout(function() {
        that.refreshDevice()
    }, that.refresh)
}

HueColorDevice.prototype._updateHMLightState = function(lightState) {
    if (this.reportFaults == true) {
        var reachable = lightState.reachable
        var ch_maintenance = this.hmDevice.getChannelWithTypeAndIndex("MAINTENANCE", 0)
        var postToCCU = (ch_maintenance.getValue("UNREACH") == reachable)
        ch_maintenance.updateValue("UNREACH", !reachable, true)
        if (reachable == false) {
            ch_maintenance.updateValue("STICKY_UNREACH", true, true)
        }
    }
    this.bri = lightState.bri
    if (this.bri < 1) {
        this.bri = 1
    }
    if (this.bri > 254) {
        this.bri = 254
    }
    let di_channel = this.hmDevice.getChannelWithTypeAndIndex("DIMMER", "1")
    let co_channel = this.hmDevice.getChannelWithTypeAndIndex("RGBW_COLOR", "2")
    let white = co_channel.getParamsetValueWithDefault("MASTER", "WHITE_HUE_VALUE", 39609)

    if ((di_channel != undefined) && (co_channel != undefined)) {

        if (lightState.on === true)  {
            di_channel.updateValue("LEVEL", (lightState.bri / 254), true)

            if (lightState.hue === white) {
                co_channel.updateValue("COLOR", 200, true)
            } else {
                co_channel.updateValue("COLOR", Math.round((lightState.hue / 65535) * 199), true)
            }

        } else {
            di_channel.updateValue("LEVEL", 0, true)
        }
    }
}

HueColorDevice.prototype._refreshDevice = function() {
    let that = this
    that.log.debug("Refreshing Devices")

    if (that.isGroup == true) {
        that.api.groups.getGroupState(that.lightId).then(function(groupState) {
            that._updateHMLightState(groupState)
        })
    } else {
        that.api.lights.getLightState(that.lightId).then(function(lightState) {
            that._updateHMLightState(lightState)
        })
    }
}


HueColorDevice.prototype.refreshLight = function() {
    let that = this
    setTimeout(function() {

        that._refreshDevice()

    }, Math.random * 1000)
}


module.exports = {
    HueColorDevice: HueColorDevice
}