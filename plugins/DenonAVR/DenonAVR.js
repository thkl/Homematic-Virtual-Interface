'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot, '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib') }
appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

const url = require('url')
const Telnet = require('telnet-client')

module.exports = class DenonAVR extends HomematicVirtualPlatform {
  init () {
    this.hm_layer = this.server.getBridge()
    var devfile = path.join(__dirname, 'HM-RC-19_Denon.json')
    this.server.publishHMDevice(this.getName(), 'HM-RC-19_Denon', devfile, 1)
    this.reinit()
    this.plugin.initialized = true
    this.log.info('initialization completed %s', this.plugin.initialized)
  }

  reinit () {
    let self = this
    this.hm_layer.deleteDevicesByOwner(this.name)
    this.remotes = []
    this.configuration = this.server.configuration
    let numOfRemotes = parseInt(this.configuration.getValueForPluginWithDefault(this.name, 'numOfRemotes', 1))
    for (var i = 0; i < numOfRemotes; i++) {
      let serial = 'HMD0000' + String(i)
      let hmDevice = this.bridge.initDevice(this.getName(), serial, 'HM-RC-19_Denon', serial)

      hmDevice.on('device_channel_value_change', function (parameter) {
        if (parameter.name === 'PRESS_SHORT') {
          let channel = hmDevice.getChannel(parameter.channel)
          let command = channel.getParamsetValueWithDefault('MASTER', 'CMD_PRESS_SHORT', undefined)
          if (command) {
            self.log.debug('PRESS_SHORT Command is %s', command)
            self.sendCommand(command)
          }
        }

        if (parameter.name === 'PRESS_LONG') {
          let channel = hmDevice.getChannel(parameter.channel)
          let command = channel.getParamsetValueWithDefault('MASTER', 'CMD_PRESS_LONG', undefined)
          if (command) {
            self.log.debug('PRESS_LONG Command is %s', command)
            self.sendCommand(command)
          }
        }
      })
      this.remotes.push(hmDevice)
    }
  }

  sendCommand (command) {
    let self = this
    let host = this.config.getValueForPlugin(this.name, 'host')
    this.log.info('Connecting to %s', host)
    let connection = new Telnet()

    let params = {
      host: host,
      port: 23,
      negotiationMandatory: false,
      timeout: 1500,
      separator: false
    }

    connection.connect(params)
      .then(function (prompt) {
        self.log.info('connected')

        connection.exec(command + '\r')
          .then(function (res) {
            self.log.info('promises result:', res)
          })
      }, function (error) {
        self.log.error('promises reject:', error)
      })
      .catch(function (error) {
        self.log.error('connection error:', error)
      })
  }

  showSettings () {
    var result = []

    let host = this.configuration.getValueForPlugin(this.name, 'host')
    let numOfRemotes = this.configuration.getValueForPlugin(this.name, 'numOfRemotes')

    result.push({'control': 'text', 'name': 'host', 'label': 'AVR Host -IP', 'value': host})
    result.push({'control': 'text', 'name': 'numOfRemotes', 'label': 'Number of remotes', 'value': numOfRemotes})
    return result
  }

  saveSettings (settings) {
    var host = settings.host
    var numOfRemotes = settings.numOfRemotes
    if (host) {
      this.configuration.setValueForPlugin(this.name, 'host', host)
    }
    if (numOfRemotes) {
      this.configuration.setValueForPlugin(this.name, 'numOfRemotes', numOfRemotes)
    }
    this.reinit()
  }

  handleConfigurationRequest (dispatchedRequest) {
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
}
