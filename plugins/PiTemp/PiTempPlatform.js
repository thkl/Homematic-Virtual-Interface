'use strict'

const path = require('path')
const fs = require('fs')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) {
    appRoot = appRoot + '/../lib'
}

if (appRoot.endsWith('node_modules/daemonize2/lib')) {
    appRoot = path.join(appRoot, '..', '..', '..', 'lib')

    if (!fs.existsSync(path.join(appRoot, 'HomematicVirtualPlatform.js'))) {
        appRoot = path.join(path.dirname(require.main.filename), '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib')
    }
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var spawn = require("child_process").spawn

function PiTempPlatform(plugin, name, server, log, instance) {
    PiTempPlatform.super_.apply(this, arguments)
    HomematicDevice = server.homematicDevice
}

util.inherits(PiTempPlatform, HomematicVirtualPlatform)

PiTempPlatform.prototype.init = function() {

    var that = this
    this.configuration = this.server.configuration
        // Core has the termostate file
    var serial = 'PiTemp'
    this.hmDevice = this.bridge.initDevice(this.getName(), serial, "HM-WDS40-TH-I-2", serial)

    setTimeout(function() {
        // check value
        that.loadValues()
    }, 1000)


    this.plugin.initialized = true
    this.log.info('initialization completed %s', this.plugin.initialized)
}

PiTempPlatform.prototype.loadValues = function(dispatchedRequest) {
    let that = this
    let fileName = '/sys/class/thermal/thermal_zone0/temp'
    var coreTemperature = 0

    try {

        if (fs.existsSync(fileName)) {
            coreTemperature = parseFloat(fs.readFileSync(fileName))
        }

        this.coreTemp = (coreTemperature / 1000)
        that.bridge.startMulticallEvent(500)
        let channel = that.hmDevice.getChannelWithTypeAndIndex("WEATHER", "1")
        if (channel) {
            channel.updateValue("TEMPERATURE", this.coreTemp, true, true);
        }
        that.bridge.sendMulticallEvents()


    } catch (e) {
        this.log.error(e)
    }

    setTimeout(function() {
        that.loadValues()
    }, 60000)

}

PiTempPlatform.prototype.handleConfigurationRequest = function(dispatchedRequest) {
    var template = 'index.html'
    var requesturl = dispatchedRequest.request.url
    var queryObject = url.parse(requesturl, true).query
    var coreTemp = ''

    if (queryObject['do'] !== undefined) {
        switch (queryObject['do']) {

            case 'app.js':
                {
                    template = 'app.js'
                }
                break

        }
    }

    coreTemp = 'Temp: ' + this.coreTemp + ' °C'

    dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {
        'coreTemp': coreTemp
    })
}

module.exports = PiTempPlatform