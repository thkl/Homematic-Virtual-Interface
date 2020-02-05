'use strict'

//
//  CCUDevice.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright 2020 kSquare.de. All rights reserved.
//

var HomematicDevice;
var HueDevice = require(__dirname + '/HueDevice.js').HueDevice;
var util = require('util')


var CCUDevice = function(hueserver, data) {
    CCUDevice.super_.apply(this, arguments)
    this.hmDevice;
    this.name = data["name"]
    this.type = data["type"]
    this.index = data["index"]
    this.isReal = false;
    this.address = data["adress"]
    this.ctype = data["ctype"]
    this.uniqueid = "1234_" + this.index;
    this.log.info('init CCU Device ObjectType %s, CCUType %s', this.objType, this.ctype)
    this.init();
}

util.inherits(CCUDevice, HueDevice)


CCUDevice.prototype.init = function() {
    var that = this;
    this.log.info("Init new CCUDevice %s Name %s", this.index, this.name);
    this.initRealDevice()
}

CCUDevice.prototype.initRealDevice = function(hmtype) {
    var that = this
    if (this.type == "3") {
        if (this.ctype === 'SWITCH') {
            this.addLightState('on', 0)
            this.addLightState('bri', 0)
            this.objType = "on/off plug-in unit"
        }

        if (this.ctype === 'DIMMER') {
            this.addLightState('on', 0)
            this.addLightState('bri', 0)
            this.objType = "dimmable light"
        }
    }

}

CCUDevice.prototype.stateDidChanged = function(state, oldvalue, newvalue) {
    if (this.type == '3') {
        // Set Level when its a Dimmer
        if (this.ctype == 'DIMMER') {
            if (state === 'bri') {
                this.bridge.callRPCMethod('BidCos-RF', 'setValue', [this.address, 'LEVEL', {
                    'explicitDouble': (newvalue / 255)
                }], function(error, value) {});

                if ((state === 'on') && (newvalue === false)) {
                    this.bridge.callRPCMethod('BidCos-RF', 'setValue', [this.address, 'LEVEL', {
                        'explicitDouble': 0
                    }], function(error, value) {});

                }
            }
        }
        // If its a switch only use the on flag
        if (this.ctype == 'SWITCH') {
            if (state === 'on') {
                this.bridge.callRPCMethod('BidCos-RF', 'setValue', [this.address, 'STATE', newvalue],
                    function(error, value) {});

            }
        }

    }
}

CCUDevice.prototype.fetchState = async function(callback) {
    let that = this

    if (this.type == '3') {
        if (this.ctype == 'SWITCH') {

            let promise = new Promise((resolve, reject) => {
                that.bridge.getValue('BidCos-RF', this.address, 'STATE', function(value) {
                    resolve(value)
                })
            })
            var value = await promise
            this.setOn(value, true)
            this.setBrightness(value ? 100 : 0, true)
        }

    }
    if (callback) {
        callback()
    }
}

module.exports = {
    CCUDevice: CCUDevice
}