'use strict'

var path = require('path')
var appRoot = path.dirname(require.main.filename)
const http = require('http')
const querystring = require('querystring')
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = path.join(appRoot, '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib') }
appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

const url = require('url')

module.exports = class DenonAVRHTTP extends HomematicVirtualPlatform {
  init () {
    this.hm_layer = this.server.getBridge()
    var devfile = path.join(__dirname, 'HM-RC-19_Denon.json')
    this.server.publishHMDevice(this.getName(), 'HM-RC-19_Denon', devfile, 2)
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

        if (parameter.name === 'TARGET_VOLUME') {
          let newVolume = parameter.newValue
          self.sendCommand('MV' + newVolume)
        }
      })
      this.remotes.push(hmDevice)
    }
    setInterval(() => {
      self.getVolume()
    }, 10000)
  }

  getVolume () {
    let self = this
    let hmDevice = this.remotes[0]
    if (hmDevice) {
      let host = this.config.getValueForPlugin(this.name, 'host')
      this.log.info('Connecting to %s', host)
      let urlCommand = querystring.stringify('MV?')
      this.log.info('Command is %s', urlCommand)
      let responseData
      const options = {
        hostname: host,
        port: 8080,
        path: '/goform/formiPhoneAppDirect.xml?' + urlCommand,
        method: 'GET'
      }

      const req = http.request(options, res => {
        res.on('data', d => {
          responseData = responseData + d
        })

        res.on('end', () => {
          // check on errors
          try {
            if (responseData) {
              let channel = hmDevice.getChannel(19)
              if (channel) {
                self.log.debug('Got volume set to %s', responseData)
                channel.updateValue('TARGET_VOLUME', responseData, true, true)
              }
            }
          } catch (e) {}
        })
      })

      req.end()
    }
  }

  sendCommand (command) {
    let self = this
    let host = this.config.getValueForPlugin(this.name, 'host')
    this.log.info('Connecting to %s', host)
    let urlCommand = querystring.stringify(command)
    this.log.info('Command is %s', urlCommand)
    const options = {
      hostname: host,
      port: 8080,
      path: '/goform/formiPhoneAppDirect.xml?' + urlCommand,
      method: 'GET'
    }

    const req = http.request(options, res => {
      self.log.debug('Request sent')
    })

    req.end()
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
