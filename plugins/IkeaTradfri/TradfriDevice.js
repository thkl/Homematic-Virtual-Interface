'use strict'

var HomematicDevice;

var TradfriDevice = function(plugin, id) {

    var that = this

    this.api = plugin.tradfri

    this.trApiLightbulbs = plugin.trApiLightbulbs
    this.trApiLightbulb = plugin.trApiLightbulbs[id]
    this.log = plugin.log
    this.bridge = plugin.server.getBridge()
    this.plugin = plugin

    HomematicDevice = plugin.server.homematicDevice

    this.id = id
    this.onTime = 0
    this.lastLevel = 0
    this.curLevel = 0
    this.defaultTransitiontime = 0.5
    this.transitiontime = this.defaultTransitiontime

    this.hmDevice = new HomematicDevice(this.plugin.getName())
    this.serial = 'Tradfri' + this.id

    if (this.trApiLightbulb.lightList[0]._spectrum == 'white') {

        this.HMType = 'VIR-LG-WHITE-DIM_Tradfri'
        this.HMChannel = 'VIR-LG_WHITE-DIM-CH'

    } else if (this.trApiLightbulb.lightList[0]._spectrum == 'rgb') {

        this.HMType = 'VIR-LG-RGB-DIM_Tradfri'
        this.HMChannel = 'VIR-LG_RGB-DIM-CH'

    } else if (this.trApiLightbulb.lightList[0]._spectrum == 'none') {

        this.HMType = 'VIR-LG-DIM_Tradfri'
        this.HMChannel = 'VIR-LG_DIM-CH'

    }

    this.log.debug('Device: Setup new Tradfri %s', this.serial)

    var data = this.bridge.deviceDataWithSerial(this.serial)

    if (data != undefined) {
        this.hmDevice.initWithStoredData(data)
    }

    if (this.hmDevice.initialized === false) {
        this.hmDevice.initWithType(this.HMType, this.serial)
        this.hmDevice.serialNumber = this.serial
        this.bridge.addDevice(this.hmDevice, true)
    } else {
        this.bridge.addDevice(this.hmDevice, false)
    }

    // Update Tradfri Gateway Devices on Homematic changes //////////////////////////////////////////////////
    //
    //
    //
    this.hmDevice.on('device_channel_value_change', function(parameter) {

        // that.log.debug('Homematic change event %s recieved: %s, update Tradfri', parameter.name, parameter.newValue)

        var newValue = parameter.newValue
        var channel = that.hmDevice.getChannel(parameter.channel)

        if (parameter.name == 'INSTALL_TEST') {

            that.setLevel(1)

            setTimeout(function() {
                that.setLevel(0)
                channel.endUpdating('INSTALL_TEST')
            }, 1000)
        }


        if (parameter.name == 'LEVEL') {

            that.setLevel(newValue)

            if ((that.onTime > 0) && (newValue > 0)) {
                setTimeout(function() {
                    that.setLevel(0)
                }, that.onTime * 1000)
            }

            // reset the transition and on time
            that.transitiontime = that.defaultTransitiontime
            that.onTime = 0

            if (newValue > 0) {
                that.lastLevel = newValue
            }

        }


        if (parameter.name == 'OLD_LEVEL') {

            if (newValue == true) {
                if (that.lastLevel == 0) {
                    that.lastLevel = 1
                }
                that.setLevel(that.lastLevel)

                // reset the transition time
                that.transitiontime = that.defaultTransitiontime

            }

        }


        if ((parameter.name == 'RAMP_TIME') && (channel.index == '1')) {
            that.transitiontime = newValue * 10
        }


        if ((parameter.name == "ON_TIME") && (channel.index == '1')) {
            that.onTime = newValue
        }


        if (parameter.name == 'WHITE') {

            that.setWhite(newValue)

            // reset the transition time
            that.transitiontime = that.defaultTransitiontime

        }


        if (parameter.name == 'RGB') {

            that.setColor(newValue)

            // reset the transition time
            that.transitiontime = that.defaultTransitiontime

        }
    })

    // Update Homematic Devices on Tradfri Gateway changes //////////////////////////////////////////////////
    //
    //
    //
    that.api.on('device updated', function(parameter) {

        if (parameter.instanceId == that.id) {

            // that.log.debug('Tradfri change event recieved, update Homematic')
            that.bridge.startMulticallEvent(500)
            var di_channel = that.hmDevice.getChannelWithTypeAndIndex(that.HMChannel, '1')
            that.updateHM(di_channel, parameter)
            that.bridge.sendMulticallEvents()
        }
    })

    // first time initialise on plugin startup
    // that.log.debug('HM device first time init %s', that.id)
    that.bridge.startMulticallEvent(500)
    var in_channel = that.hmDevice.getChannelWithTypeAndIndex(that.HMChannel, '1')
    that.updateHM(in_channel, that.trApiLightbulb)
    that.bridge.sendMulticallEvents()

}

// Set the color on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriDevice.prototype.setColor = function(newValue) {

    var regex = /(\s*[0-9]{1,3}),(\s*[0-9]{1,3}),(\s*[0-9]{1,3})/

    var result = newValue.match(regex);

    var r = parseInt(result[1].trim());
    var g = parseInt(result[2].trim());
    var b = parseInt(result[3].trim());

    // // use HEX to set the color
    let newColor = this.RGBtoHEX(r, g, b) // bring from rgb to hex

    this.api.operateLight(this.trApiLightbulb, {
        color: newColor,
        transitionTime: this.transitiontime,
    }).then((result) => {
        // this.log.debug('Tradfri %s Color %s', this.id, newColor)
    }).catch((error) => {
        this.log.error('Tradfri setColor %s', error);
    })
}

// Set the white spectrum on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriDevice.prototype.setWhite = function(newValue) {

    var newTemp = 100 - ((newValue - 2200) / 18) // bring to 0 - 100

    this.api.operateLight(this.trApiLightbulb, {
        colorTemperature: newTemp,
        transitionTime: this.transitiontime,
    }).then((result) => {
        // this.log.debug('Tradfri %s Colortemp %s: %s',this.id, newTemp, result)
    }).catch((error) => {
        this.log.error('Tradfri setWhite %s', error);
    })
}

// Set the level on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriDevice.prototype.setLevel = function(newValue) {

    this.curLevel = newValue

    var newLevel = newValue * 100 // bring to 0 - 100

    var OnOff = false

    if (newLevel != 0) {
        OnOff = true
    }

    this.api.operateLight(this.trApiLightbulb, {
        onOff: OnOff,
        dimmer: newLevel,
        transitionTime: this.transitiontime
    }).then((result) => {
        // this.log.info('Tradfri %s Level %s: %s', this.id, newLevel, result)
    }).catch((error) => {
        this.log.error('Tradfri setLevel %s', error)
    })
}


// update the dataset on the Homematic //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriDevice.prototype.updateHM = function(di_channel, parameter) {

    var that = this

    // set dimmer level if Lamp is on
    var hmLevel = 0

    if (parameter.lightList[0].onOff == true) {

        hmLevel = parameter.lightList[0].dimmer / 100 // bring to 0 - 1
        that.curLevel = parameter.lightList[0].dimmer

        if (di_channel != undefined) {

            // that.log.debug('HM LEVEL %s and ON', hmLevel)

            di_channel.updateValue('LEVEL', parseFloat(hmLevel), true, true)
        }
    } else {
        if (di_channel != undefined) {

            // that.log.debug('HM LEVEL %s and OFF', hmLevel)

            di_channel.updateValue('LEVEL', parseFloat(hmLevel), true, true)
        }
    }

    if (that.trApiLightbulb.lightList[0]._spectrum == 'rgb') {

        var color = 'rgb(' + this.HEXtoRGB('#' + parameter.lightList[0].color) + ')' // bring from hex to rgb

        if (di_channel != undefined) {

            // that.log.debug('HM RGB %s from Hex %s', color, parameter.lightList[0].color)

            di_channel.updateValue('RGB', String(color), true, true)
        }
    }

    if (that.trApiLightbulb.lightList[0]._spectrum == 'white') {

        var hmColorTemperature = (100 - parameter.lightList[0].colorTemperature) * 18 + 2200 // bring to 2200 - 4000

        if (di_channel != undefined) {

            // that.log.debug('HM WHITE %s',hmColorTemperature)

            di_channel.updateValue('WHITE', parseInt(hmColorTemperature), true, true)
        }
    }
}

// helper functions //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriDevice.prototype.RGBtoHSV = function(r, g, b) {

    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    var max = Math.max(r, g, b),
        min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min:
            h = 0;
            break;
        case r:
            h = (g - b) + d * (g < b ? 6 : 0);
            h /= 6 * d;
            break;
        case g:
            h = (b - r) + d * 2;
            h /= 6 * d;
            break;
        case b:
            h = (r - g) + d * 4;
            h /= 6 * d;
            break;
    }

    // normalize for the Tradfri API
    h = h * 360
    s = s * 100
    v = v * 100

    return {
        h: h,
        s: s,
        v: v
    };
}


TradfriDevice.prototype.RGBtoHEX = function(r, g, b) {

    var hex = [r, g, b].map(x => {
        const hex = x.toString(16)
        return hex.length === 1 ? '0' + hex : hex
    }).join('');

    return hex;
}

TradfriDevice.prototype.HEXtoRGB = function(hex) {

    var rgb = hex.replace(/^#?([a-f\d])([a-f\d])([a-f\d])$/i, (m, r, g, b) => '#' + r + r + g + g + b + b)
        .substring(1).match(/.{2}/g)
        .map(x => parseInt(x, 16));

    return rgb;
}


module.exports = {
    TradfriDevice: TradfriDevice
}