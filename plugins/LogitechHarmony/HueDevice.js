var HueDevice = function(hueserver, data) {
    this.name = data["name"];
    this.index = data["id"];
    this.isReal = true;
    this.lightState = {
        on: false
    }
    this.hueserver = hueserver;
    this.bridge = hueserver.bridge;
    this.log = hueserver.log;
    this.log.debug('[HueDevice] init')
}


HueDevice.prototype.setLightState = function(state, newState) {
    if (this.lightState[state] !== undefined) {
        if (this.lightState[state] !== state) {
            this.log.debug('[HueDevice] change lightstate %s to %s', state, newState)
            if (this.canChange(state)) {
                let oldState = this.lightState[state]
                this.stateWillChange(state, oldState, newState)
                this.lightState[state] = newState
                this.stateDidChanged(state, oldState, newState)
            }
        }
    } else {
        this.log.warn('[HueDevice] %s is unknown', JSON.stringify(state))

    }
}

HueDevice.prototype.getLightState = function() {
    if (this.lightState === undefined)  {
        this.lightState = {}
    }
    return this.lightState
}

HueDevice.prototype.addLightState = function(state, initialValue) {
    this.log.debug('[HueDevice] Adding %s to lightstate', state)
    if (this.lightState === undefined)  {
        this.lightState = {}
    }
    this.lightState[state] = initialValue
}

HueDevice.prototype.setXY = function(newXY, force) {
    var newState = this.getLightState()
    this.log.debug('[HueDevice]  setXY to %s', JSON.stringify(newState))
    if (newState.xy != undefined) {
        let xy = JSON.parse('[' + newXY + ']')
        this.setLightState('xy', newState)
    }
}

HueDevice.prototype.setOn = function(isOn, force) {
    if (force) {
        this.getLightState().on = isOn
    } else {
        this.setLightState('on', isOn)
    }
}

HueDevice.prototype.canChange = function(newState) {
    return true
}

HueDevice.prototype.setBrightness = function(newBrightness, force) {
    this.setLightState('bri', newBrightness)
}

HueDevice.prototype.validateBrightness = function(newBrightness) {
    return newBrightness;
}

HueDevice.prototype.xy = function() {
    return JSON.stringify(this.lightState.xy)
}

HueDevice.prototype.isOn = function() {
    return this.getLightState().on
}

HueDevice.prototype.brightness = function() {
    return this.getLightState().bri
}

HueDevice.prototype.getId = function() {
    return this.index
}

HueDevice.prototype.getState = function(callback) {
    let that = this
    this.fetchState(function() {
        var result = {}
        result.state = that.getLightState()
        result.swupdate = {
            'state': 'noupdates',
            'lastinstall': '1970-01-01T00:00:00'
        }
        result.type = that.objType
        result.name = that.name
        result.uniqueid = that.uniqueid
        result.swversion = "1.0"
        callback(result)
    })
}


HueDevice.prototype.fetchState = function(callback) {
    if (callback) {
        callback()
    }
}

HueDevice.prototype.stateWillChange = function(state, oldvalue, newvalue) {}
HueDevice.prototype.stateDidChanged = function(state, oldvalue, newvalue) {}

module.exports = {
    HueDevice: HueDevice
}