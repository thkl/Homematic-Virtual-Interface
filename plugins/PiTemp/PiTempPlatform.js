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

    var devfile = path.join(__dirname, 'HM-WDS40-TH-I-2.json');
    this.server.publishHMDevice(this.getName(), 'HM-WDS40-TH-I-2', devfile, 1);
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

    //var regex = /temp=([^'C]+)/;
    //    var cmd = spawn("/opt/vc/bin/vcgencmd", ["measure_temp"]);

    var regex = /[0-9]{5}/
    var cmd = spawn("cat", ["/sys/class/thermal/thermal_zone0/temp"]);

    cmd.stdout.on("data", function(buf) {
        var coreTemperature = parseFloat(regex.exec(buf.toString("utf8"))[0]);
        coreTemperature = (coreTemperature / 1000)
        that.bridge.startMulticallEvent(500)
        let channel = that.hmDevice.getChannelWithTypeAndIndex("WEATHER", "1")
        if (channel) {
            channel.updateValue("TEMPERATURE", coreTemperature, true, true);
        }
        that.bridge.sendMulticallEvents()

    });

    cmd.stderr.on("data", function(buf) {
        callback(new Error(buf.toString("utf8")));
    });



    setTimeout(function() {
        that.loadValues()
    }, 60000)

}

PiTempPlatform.prototype.handleConfigurationRequest = function(dispatchedRequest) {
    var template = 'index.html'
    var requesturl = dispatchedRequest.request.url
    var queryObject = url.parse(requesturl, true).query
    var deviceList = ''

    if (queryObject['do'] !== undefined) {
        switch (queryObject['do']) {

            case 'app.js':
                {
                    template = 'app.js'
                }
                break

        }
    }

    dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {
        'listDevices': deviceList
    })
}

module.exports = PiTempPlatform