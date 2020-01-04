'use strict'

var HomematicDevice;

var TradfriBlind = function(plugin, id) {

    var that = this

    this.api = plugin.tradfri

    this.trApiBlind = plugin.trApiBlinds[id]
    this.log = plugin.log
    this.bridge = plugin.server.getBridge()
    this.plugin = plugin

    HomematicDevice = plugin.server.homematicDevice

    this.id = id
    this.onTime = 0
    this.inhibit = false
    this.setLevel = 0
    this.curLevel = 0
    this.hmDevice = new HomematicDevice(this.plugin.getName())
    this.serial = 'Tradfri' + this.id

    this.HMType = 'HM-LC-Bl1PBU-FM_Tradfri'
    this.HMChannel = 'BLIND'

    this.log.debug('Device: Setup new Tradfri Blind %s', this.serial)


    this.hmDevice = this.bridge.initDevice(this.plugin.getName(), this.serial, "HM-LC-Bl1PBU-FM_Tradfri", this.serial)


    // Update Tradfri Gateway Devices on Homematic changes //////////////////////////////////////////////////
    //
    //
    //
    this.hmDevice.on('device_channel_value_change', function(parameter) {

        that.log.debug('Homematic change event %s recieved: %s, update Tradfri', parameter.name, parameter.newValue)

        var newValue = parameter.newValue
        var channel = that.hmDevice.getChannel(parameter.channel)

        if (parameter.name == 'INSTALL_TEST') {


        }



        if (parameter.name === 'LEVEL') {
            var newLevel = newValue * 100 // bring to 0 - 100

            that.setLevel = newLevel

            if (that.inhibit === true) {
                that.log.debug('skip levelset inhibit is true')
                return
            } else {
                that.log.debug('set blind level to %s', newLevel)
                that.setNewLevel(that.setLevel)
            }

        }

        if (parameter.name === 'INHIBIT') {

            that.inhibit = newValue
            if (that.inhibit === true) {
                that.log.debug("Processing inhibit is true")
                that.stop()
            } else {
                that.log.debug("Processing inhibit is false")
                if ((that.inhibit === false) && (that.curLevel != that.setLevel)) {
                    that.setNewLevel(that.setLevel)
                }
            }
        }

        if (parameter.name === 'STOP') {
            that.stop()
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
            that.log.debug('blind update %s', JSON.stringify(parameter))
            that.updateHM(di_channel, parameter)
            that.bridge.sendMulticallEvents()
            that.plugin.updateBlindGroups()
            clearTimeout(that.endMovingTimer)
            that.endMovingTimer = setTimeout(function() {
                var di_channel = that.hmDevice.getChannelWithTypeAndIndex(that.HMChannel, '1')
                di_channel.updateValue('WORKING', 0, true, true)
            }, 1000)
        }
    })

    // first time initialise on plugin startup
    // that.log.debug('HM device first time init %s', that.id)
    that.bridge.startMulticallEvent(500)
    var in_channel = that.hmDevice.getChannelWithTypeAndIndex(that.HMChannel, '1')
    that.updateHM(in_channel, that.trApiBlind, true)
    that.bridge.sendMulticallEvents()

}

TradfriBlind.prototype.stop = function() {
    let that = this
    that.api.operateBlind(that.trApiBlind, {
            trigger: 0.0
        })
        .then((result) => {

        }).catch((error) => {
            that.log.error('Tradfri Blind STOP Error %s', error);
        })
}


TradfriBlind.prototype.setNewLevel = function(newLevel) {
    let that = this
    that.api.operateBlind(that.trApiBlind, {
        position: newLevel
    }).then((result) => {

    }).catch((error) => {
        that.log.error('Tradfri Blind setPosition Error %s', error);
    })
}



// update the dataset on the Homematic //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriBlind.prototype.updateHM = function(di_channel, parameter, first) {
    let that = this
    if (parameter.blindList[0].position) {
        that.curLevel = parameter.blindList[0].position
        let hmLevel = parameter.blindList[0].position / 100 // bring to 0 - 1
        di_channel.updateValue('LEVEL', parseFloat(hmLevel), true, true)
        if (first) {
            that.setLevel = that.curLevel
        } else {
            di_channel.updateValue('WORKING', 1, true, true)
        }
    }
    if (parameter.deviceInfo.battery) {
        // Update Maintenance 
        var mi_channel = that.hmDevice.getChannelWithTypeAndIndex('MAINTENANCE', '0')
        if (mi_channel) {
            let bp = parseInt(parameter.deviceInfo.battery)
                // Only update new values .. do not notifiy on old ones
            mi_channel.updateValue('BAT_PERCENT', bp, true, false)
            if (bp < 20) {
                mi_channel.updateValue('LOWBAT', true, true, false)
            } else {
                mi_channel.updateValue('LOWBAT', false, true, false)
            }
        }
    }
}

module.exports = {
    TradfriBlind: TradfriBlind
}