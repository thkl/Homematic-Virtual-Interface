'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }
appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')

function DummyPlatform (plugin, name, server, log, instance) {
  DummyPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(DummyPlatform, HomematicVirtualPlatform)

DummyPlatform.prototype.init = function () {
  var that = this

  // create a Device like this :

  this.hmDevice = new HomematicDevice(this.getName())
  this.hmDevice.initWithType('HM-LC-RGBW-WM', 'Dummy Device')

  this.bridge.addDevice(this.hmDevice)

  // this will trigered when a value of a channel was changed by the ccu
  this.hmDevice.on('device_channel_value_change', function (parameter) {
    var newValue = parameter.newValue
    var channel = that.hmDevice.getChannel(parameter.channel)

// sample do something when level was changed
    if (parameter.name === 'LEVEL') {
// new level is in "newValue"
      console.log('Channel %s update with %s', channel, newValue)
    }
  })

  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}

DummyPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = DummyPlatform
