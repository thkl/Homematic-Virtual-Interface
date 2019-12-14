'use strict'

var HomematicDevice;

var TradfriBlindGroup = function(plugin, id, deviceIDsinGroup) {

    var that = this

    this.api = plugin.tradfri

    this.trApiBlinds = plugin.trApiBlinds
    this.log = plugin.log
    this.bridge = plugin.server.getBridge()
    this.plugin = plugin

    HomematicDevice = plugin.server.homematicDevice

    this.id = id
    this.onTime = 0
    this.inhibit = false
    this.setLevel = 0
    this.curLevel = 0

    this.devices = deviceIDsinGroup

    this.hmDevice = new HomematicDevice(this.plugin.getName())
    this.serial = 'TrGroup' + this.id

    this.HMType = 'HM-LC-Bl1PBU-FM_Tradfri'
    this.HMChannel = 'BLIND'
    this.apiblinds = []
    this.log.debug('Device: Setup new Tradfri BlindGroup %s', this.serial)

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

        that.log.debug('Homematic change event %s recieved: %s, update Group', parameter.name, parameter.newValue)

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
        }
    })

    // first time initialise on plugin startup
    // that.log.debug('HM device first time init %s', that.id)
    that.bridge.startMulticallEvent(500)
    var in_channel = that.hmDevice.getChannelWithTypeAndIndex(that.HMChannel, '1')
    that.updateHM(in_channel)
    that.bridge.sendMulticallEvents()

}

TradfriBlindGroup.prototype.stop = function() {
    let that = this
    this.devices.forEach(deviceID => {
        that.log.info('Check Device %s', deviceID)
        let blind = that.trApiBlinds[deviceID]
        if (blind)  {
            that.api.operateBlind(blind, {
                    trigger: 0.0
                })
                .then((result) => {

                }).catch((error) => {
                    that.log.error('Tradfri Blind STOP Error %s', error);
                })
        }
    })
}


TradfriBlindGroup.prototype.setNewLevel = function(newLevel) {
    let that = this

    this.devices.forEach(deviceID => {
        that.log.debug('Check Device %s', deviceID)
        let blind = that.trApiBlinds[deviceID]
        if (blind)  {
            that.log.debug('Blind found check inhbit')
            let hmblind = that.plugin.mappedDevices[deviceID]
            if (hmblind.inhibit === false) {
                that.log.debug('Operate to %s', newLevel)
                that.api.operateBlind(blind, {
                        position: newLevel
                    })
                    .then((result) => {

                    }).catch((error) => {
                        that.log.error('Tradfri Blind STOP Error %s', error);
                    })
            } else {
                that.log.warn('Its inhibit')
            }
        }

    })
}

TradfriBlindGroup.prototype.updateGroup = function() {
    var in_channel = this.hmDevice.getChannelWithTypeAndIndex(this.HMChannel, '1')
    this.updateHM(in_channel)
}


// update the dataset on the Homematic //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriBlindGroup.prototype.updateHM = function(di_channel) {
    let that = this
    var sumlevel = 0
    var cnt = 0
        // set the group Leve to the 
    this.devices.forEach(deviceID => {
        that.log.debug('Check Device %s', deviceID)
        let obj = that.trApiBlinds[deviceID]
        if (obj)  {
            // check inhibit flag of hm blind
            that.log.debug('Found my %s', deviceID)
            let hmblind = that.plugin.mappedDevices[deviceID]
            that.log.debug('Add %s', hmblind.curLevel)
            sumlevel = sumlevel + hmblind.curLevel
            cnt = cnt + 1
        }
    })
    let hmLevel = (sumlevel / cnt) / 100 // bring to 0 - 1
    that.log.info('Set GroupLevel to %s', hmLevel)

    di_channel.updateValue('LEVEL', parseFloat(hmLevel), true, true)
}

module.exports = {
    TradfriBlindGroup: TradfriBlindGroup
}