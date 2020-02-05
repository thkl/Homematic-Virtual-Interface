'use strict'

//
//  RealHueDevice.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright � 2016 kSquare.de. All rights reserved.
//

var HueDevice = require(__dirname + '/HueDevice.js').HueDevice;
var util = require('util')



var RealHueDevice = function(hueserver, data) {
    RealHueDevice.super_.apply(this, arguments)
    this.hueserver = hueserver;
    this.data = data;
    this.name = data["name"];
    this.index = data["id"];
    this.log.info("Init new RealLight Mapping ID %s Name %s", this.index, this.name);
    this.isReal = true;
    this.fetchState()
}

util.inherits(RealHueDevice, HueDevice)

RealHueDevice.prototype.stateDidChanged = function(state, oldState, newState) {
    let message = {
        'name': 'setLightState',
        'lightId': this.index,
        'newState': this.getLightState()
    }
    this.hueserver.server.sendMessageToPlugin(this.hueserver.huePluginName, message, function() {

    })
}


RealHueDevice.prototype.fetchState = async function(callback) {
    let that = this
    let message = {
        'name': 'getLightState',
        'lightId': this.index
    }
    let promise = new Promise((resolve, reject) => {
        that.hueserver.server.sendMessageToPlugin(that.hueserver.huePluginName, message, function(err, result) {
            if (err) {
                resolve()
            } else {
                that.lightState = result
                resolve(result)
            }
        })
    })
    var value = await promise
    if (callback) {
        callback()
    }
}




RealHueDevice.prototype.canChange = function(newState) {
    if (newState === 'on') {
        return true
    }
    return this.isOn()
}

RealHueDevice.prototype.validateBrightness = function(newBrightness) {
    if (newBrightness < 1) {
        newBrightness = 1
    }
    if (newBrightness > 254) {
        newBrightness = 254
    }

    return newBrightness
}

RealHueDevice.prototype.getState = function(callback) {
    let that = this
    var result = {}
    this.fetchState(function() {
        result.state = that.lightState
        result.swupdate = that.data.swversion
        result.type = that.data.type
        result.name = that.data.name
        result.modelid = that.data.modelid
        result.manufacturername = that.data.manufacturername
        result.productname = that.data.productname
        result.capabilities = that.data.capabilities
        result.config = that.data.config
        result.uniqueid = that.data.uniqueid
        result.swversion = that.data.swversion
        if (callback)  {
            callback(result)
        }
    })
}

module.exports = {
    RealHueDevice: RealHueDevice
}