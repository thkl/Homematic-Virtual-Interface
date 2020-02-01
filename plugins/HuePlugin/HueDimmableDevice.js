'use strict'

const LightState = require('node-hue-api').v3.lightStates.LightState
const GroupLightState = require('node-hue-api').v3.model.lightStates.GroupLightState

const EventEmitter = require('events')
const util = require('util')

var HomematicDevice

var HueDimmableDevice = function(plugin, hueApi, light, serialprefix) {

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

    this.config = plugin.server.configuration
    this.reportFaults = false

    if (this.config != undefined) {
        this.log.debug("Config is valid")
        this.reportFaults = this.config.getValueForPluginWithDefault(this.plugin.name, "reportFaults", false)
    }

    this.log.debug("Setup new HUE Bridged Device %s", serialprefix + this.lightId)
    this.reload()
    var serial = light["uniqueid"]
    this.hmDevice = this.bridge.initDevice(this.plugin.name, serial, "HM-LC-Dim1T-Pl", serialprefix + this.lightId)
    var uniqueid = light["uniqueid"]

    if (uniqueid != undefined) {
        this.hmDevice.serialNumber = uniqueid
    }
    this.hmDevice.firmware = light["swversion"]

    this.hmDevice.on('device_channel_install_test', function(parameter) {
        that.alert()
        var channel = that.hmDevice.getChannel(parameter.channel)
        channel.endUpdating("INSTALL_TEST")
    })


    this.hmDevice.on('device_channel_value_change', function(parameter) {

        that.log.debug("Value was changed %s", JSON.stringify(parameter))
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
                    break
                case 4:
                    that.alert()
                    break
            }
            channel.endUpdating("PROGRAM")
        }

        if (parameter.name == "LEVEL") {
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

    })

    EventEmitter.call(this)
}

util.inherits(HueDimmableDevice, EventEmitter)



HueDimmableDevice.prototype.reload = function() {
    if (this.config != undefined) {
        this.log.debug("Reload Lamp Configuration ...")
        this.refresh = (this.config.getValueForPluginWithDefault(this.plugin.name, "refresh", 60)) * 1000
        this.log.debug("Refresh Rate is %s ms", this.refresh)
    }
}

HueDimmableDevice.prototype.alert = function() {
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


HueDimmableDevice.prototype.effect = function(effectname) {
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


HueDimmableDevice.prototype.setLevel = function(newLevel) {
    this.emit('direct_light_event', this)
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
            newState.on().bri(this.bri)
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
            newState.on().bri(this.bri)
        }

        this.api.lights.setLightState(this.lightId, newState).then(function(result) {
            if (di_channel != undefined)  {
                di_channel.endUpdating("LEVEL")
            }
        })

    }
}

HueDimmableDevice.prototype.refreshDevice = function() {
    let that = this
    this._refreshDevice()
    this.updateTimer = setTimeout(function() {
        that.refreshDevice()
    }, this.refresh)
}

HueDimmableDevice.prototype._updateHMLightState = function(lightState) {
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
    var di_channel = this.hmDevice.getChannelWithTypeAndIndex("DIMMER", "1")
    if (di_channel != undefined) {
        if (lightState.on === true)  {
            di_channel.updateValue("LEVEL", (lightState.bri / 254), true)
        } else {
            di_channel.updateValue("LEVEL", 0, true)
        }
    }
}

HueDimmableDevice.prototype.setLightData = function(lightData) {
    this.api.lights.setLightState(this.lightId, lightData, function(err, result) {
        // HM SEND
    })
}

HueDimmableDevice.prototype._refreshDevice = function() {
    var that = this

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


HueDimmableDevice.prototype.refreshLight = function() {
    let that = this
    setTimeout(function() {

        that._refreshDevice()

    }, Math.random * 1000)
}


module.exports = {
    HueDimmableDevice: HueDimmableDevice
}