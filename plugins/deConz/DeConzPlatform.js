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
const { Decipher } = require('crypto')

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
const Gateway = require(path.join(__dirname, 'lib', 'Gateway.js')) // rebuild this in production to the npm

module.exports = class DeConzPlatform extends HomematicVirtualPlatform {
  init () {
    this.myPath = __dirname
    this.configuration = this.server.configuration
    this.connect()
    this.plugin.initialized = true
    this.hmDevices = []
    this.gwDevices = []
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
      this.gwDevices = []
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
      l = undefined
      switch (light.type.toLowerCase()) {
        case 'color light':
        case 'extended color light':
          self.log.debug('New Extended color light %s', light.uniqueid)
          const ExtendedColorLight = require(path.join(__dirname, 'devices', 'ExtendedColorLight.js'))
          l = new ExtendedColorLight(self, light)
          self.hmDevices.push(l.hmDevice)
          break
        case 'color temperature light':
          self.log.debug('Color temperature light %s', light.uniqueid)
          const ColorTemperatureLight = require(path.join(__dirname, 'devices', 'ColorTemperatureLight.js'))
          l = new ColorTemperatureLight(self, light)
          self.hmDevices.push(l.hmDevice)
          break
        case 'dimmable light':
          self.log.info('Dimmable light %s', light.uniqueid)
          const BasicLight = require(path.join(__dirname, 'devices', 'BasicLight.js'))
          l = new BasicLight(self, light)
          self.hmDevices.push(l.hmDevice)
          break

        default:
          self.log.info('unable to map %s (%s)', light.type, light.uniqueid)
      }
      if (l) {
        self.gwDevices.push(l)
      }
    })

    this.gateway.getBlinds().map((blind) => {
      const Blind = require(path.join(__dirname, 'devices', 'Blind.js'))
      l = new Blind(self, blind)
      self.hmDevices.push(l.hmDevice)
      self.gwDevices.push(l)
    })
  }

  mapSensors () {
    let self = this
    var s
    this.gateway.getSensors().map((sensor) => {
      s = undefined
      switch (sensor.type) {
        case 'ZHASwitch':
          self.log.debug('New ZHASwitch with serial %s', sensor.uniqueid)

          // the magic cube contains 2 sensors
          let model = sensor.modelid

          const ZHASwitch = require(path.join(__dirname, 'devices', 'ZHASwitch.js'))
          s = new ZHASwitch(self, sensor)
          s.setModel(model)
          self.hmDevices.push(s.hmDevice)
          self.gwDevices.push(s)
          break

        case 'ZHAPresence':
          self.log.debug('New ZHAPresence with serial %s', sensor.uniqueid)
          const ZHAPresence = require(path.join(__dirname, 'devices', 'ZHAPresence.js'))
          s = new ZHAPresence(self, sensor)
          self.hmDevices.push(s.hmDevice)
          self.gwDevices.push(s)
          break

        case 'ZHAWater':
          self.log.debug('New ZHAWater with serial %s', sensor.uniqueid)
          const ZHAWater = require(path.join(__dirname, 'devices', 'ZHAWater.js'))
          s = new ZHAWater(self, sensor)
          self.hmDevices.push(s.hmDevice)
          self.gwDevices.push(s)
          break

        case 'ZHAHumidity':
        case 'ZHAPressure':
        case 'ZHATemperature':

          // try to find a masterdevice
          let master = self.gwDevices.filter((device) => {
            return device.isCombo(sensor.uniqueid)
          }).pop()
          if (!master) {
            const ZHAWeatherCombiSensor = require(path.join(__dirname, 'devices', 'ZHATemperature.js'))
            s = new ZHAWeatherCombiSensor(self, sensor)
            self.hmDevices.push(s.hmDevice)
            self.gwDevices.push(s)
            self.log.info('Adding new Temp Sensor %s', s.hmSerial)
          } else {
            self.log.info('Found existing Combo device adding %s', sensor.type)
            if (master.addSensor) {
              master.addSensor(sensor)
            }
          }
          break
      }
    })
  }

  deviceWithId (id) {
    let fltr = this.gwDevices.filter(device => {
      return device.uniqueid === id
    })
    return (fltr.length > 0) ? fltr[0] : undefined
  }

  myDevices () {
    // return my Devices here
    var result = []

    this.gwDevices.forEach(function (device) {
      result.push({
        'uuid': device.uniqueid,
        'id': device.hmSerial,
        'name': device.name,
        'type': device.type,
        'serial': device.hmSerial,
        'hmType': device.hmType,
        'lastMessage': device.lastMessage,
        'lastMessageTime': device.lastMessageTime,
        'hasTestMode': device.hasTestMode,
        'plgtype': 'DECONZ'
      })
    })

    return result
  }

  showSettings () {
    let host = this.configuration.getValueForPlugin(this.name, 'host', '')
    let key = this.configuration.getValueForPlugin(this.name, 'key', '')

    var result = []
    result.push({ 'control': 'text', 'name': 'host', 'label': 'Phoscon Gateway Host', 'value': host })
    result.push({ 'control': 'password', 'name': 'key', 'label': 'Phoscon API Key', 'value': key })
    return result
  }

  saveSettings (settings) {
    this.log.debug(JSON.stringify(settings))
    let host = settings.host
    let key = settings.key
    if ((host) && (key)) {
      this.configuration.setValueForPlugin(this.name, 'host', host)
      this.configuration.setValueForPlugin(this.name, 'key', key)
      this.connect()
      return null
    }
    return 'host or key not commited'
  }

  async _handleGetRequests (method, body, request, response) {
    switch (request.query.method) {
      case 'listDevices':
        this.log.debug('Send Devices')
        response.json(this.myDevices())
        break
      case 'testDevice':
        let device = this.deviceWithId(body.uuid)
        if (device) {
          device.test()
        } else {
          this.log.error('Device with uuid %s not found', body.uuid)
          console.log(this.gwDevices)
        }
        response.json({result: 'running'})
        break
      default:
        response.json({error: 'dont know what todo'})
    }
  }

  shutdown () {
    this.log.info('Shutdown')
    if (this.gateway) {
      this.gateway.shutdown()
    }
  }
}
