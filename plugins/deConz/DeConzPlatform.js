/*
 * File: DeConzPlatform.js
 * Project: homematic-virtual-deConz
 * File Created: Saturday, 26th September 2020 3:49:50 pm
 * Author: Thomas Kluge (th.kluge@me.com)
 * -----
 * The MIT License (MIT)
 *
 * Copyright (c) Thomas Kluge <th.kluge@me.com> (https://github.com/thkl)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 * ==========================================================================
 */

'use strict'

const path = require('path')
const fs = require('fs')
const url = require('url')

var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

if (appRoot.endsWith('node_modules/daemonize2/lib')) {
  appRoot = path.join(appRoot, '..', '..', '..', 'lib')

  if (!fs.existsSync(path.join(appRoot, 'HomematicVirtualPlatform.js'))) {
    appRoot = path.join(path.dirname(require.main.filename), '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib')
  }
}

appRoot = path.normalize(appRoot)

const HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
const Gateway = require(path.join(__dirname, 'lib', 'Gateway.js'))

class DeConzPlatform extends HomematicVirtualPlatform {
  init () {
    this.configuration = this.server.configuration
    this.connect()
    this.plugin.initialized = true
    this.log.info('initialization completed %s', this.plugin.initialized)
  }

  async connect () {
    let self = this
    if (this.gateway) {
      this.gateway.shutdown()
    }

    let host = this.configuration.getValueForPlugin(this.name, 'host', undefined)
    let key = this.configuration.getValueForPlugin(this.name, 'key', undefined)
    if (host !== undefined) {
      this.gateway = new Gateway(host, 80, this.log)
    } else {
      return
    }

    if (key !== undefined) {
      this.hmDevices = []
      this.gateway.setApikey(key)
      await this.gateway.connect()
      this.mapSensors()
      this.mapActors()
      this.hmDevices.map(device => {
        self.log.debug('Device %s', device.serialNumber)
      })
    } else {
      // message to setup gateway into pairing Mode
      this.gateway.registerApplication('hvlDeConz').then((result, error) => {
        if (!error) {
          if ((result.success) && (result.success.username)) {
            // save the username
            self.configuration.setValueForPlugin(self.name, 'key', result.success.username)
            // connect to the gw in 5 ...
          }
        }
        self.setTimeout(() => { self.connect() }, 5000)
      })
    }
  }

  mapActors () {
    let self = this
    var l
    this.gateway.getLights().map((light) => {
      switch (light.type) {
        case 'Extended color light':
          self.log.debug('New Extended color light %s', light.uniqueid)
          const ExtendedColorLight = require(path.join(__dirname, 'devices', 'ExtendedColorLight.js'))
          l = new ExtendedColorLight(self, light)
          self.hmDevices.push(l.hmDevice)
          break
        case 'Color temperature light':
          self.log.debug('Color temperature light %s', light.uniqueid)
          const ColorTemperatureLight = require(path.join(__dirname, 'devices', 'ColorTemperatureLight.js'))
          l = new ColorTemperatureLight(self, light)
          self.hmDevices.push(l.hmDevice)

          break
      }
    })
  }

  mapSensors () {
    let self = this
    this.gateway.getSensors().map((sensor) => {
      switch (sensor.type) {
        case 'ZHASwitch':
          self.log.debug('New ZHASwitch with serial %s', sensor.uniqueid)
          const ZHASwitch = require(path.join(__dirname, 'devices', 'ZHASwitch.js'))
          let d = new ZHASwitch(self, sensor)
          self.hmDevices.push(d.hmDevice)
          break

        case 'ZHAPresence':
          self.log.debug('New ZHAPresence with serial %s', sensor.uniqueid)
          const ZHAPresence = require(path.join(__dirname, 'devices', 'ZHAPresence.js'))
          let s = new ZHAPresence(self, sensor)
          self.hmDevices.push(s.hmDevice)
          break
      }
    })
  }

  showSettings (dispatched_request) {
    let host = this.configuration.getValueForPlugin(this.name, 'host', '')
    let key = this.configuration.getValueForPlugin(this.name, 'key', '')

    var result = []
    result.push({ 'control': 'text', 'name': 'host', 'label': 'Phoscon Gateway Host', 'value': host })
    result.push({ 'control': 'text', 'name': 'key', 'label': 'Phoscon API Key', 'value': key })
    return result
  }

  saveSettings (settings) {
    let host = settings.host
    let key = settings.key
    if ((host) && (key)) {
      this.configuration.setValueForPlugin(this.name, 'host', host)
      this.configuration.setValueForPlugin(this.name, 'key', key)
      this.connect()
    }
  }

  handleConfigurationRequest (dispatchedRequest) {
    var template = 'index.html'
    var requesturl = dispatchedRequest.request.url
    var queryObject = url.parse(requesturl, true).query
    var deviceList = ''

    if (queryObject['do'] !== undefined) {
      switch (queryObject['do']) {
        case 'app.js':
          template = 'app.js'
          break
      }
    } else {
      var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath, 'list_device_tmp.html', null)
      this.hmDevices.map(hmdevice => {
        deviceList = deviceList + dispatchedRequest.fillTemplate(devtemplate, {'device_id': hmdevice.serialNumber})
      })
    }

    dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
  }

  shutdown () {
    this.log.info('Shutdown')
    this.gateway.shutdown()
  }
}
module.exports = DeConzPlatform
