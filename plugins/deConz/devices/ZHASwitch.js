/*
 * File: ZHASwitch.js
 * Project: homematic-virtual-deConz
 * File Created: Saturday, 26th September 2020 4:35:25 pm
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

const path = require('path')
const fs = require('fs')
const DeConzDevice = require(path.join(__dirname, 'DeConzDevice.js'))

class ZHASwitch extends DeConzDevice {
  constructor (plugin, sensor) {
    super(plugin, sensor, 'HM-RC-8')
    let self = this
    this.buttons = {}
    sensor.on('change', () => {
      self.lastMessageTime = new Date()
      self.proceedButtons(sensor)
    })
    this.sensor = sensor
    this.setModel(null)
    this.updateSensor()
  }

  updateSensor () {
    let self = this
    this.gateway.refreshSensor(this.sensor).then(() => {
      let mC = self.hmDevice.getChannelWithTypeAndIndex('MAINTENANCE', 0)
      mC.updateValue('LOWBAT', (this.sensor.battery < 40), true, true)
    })
    setTimeout(() => {
      self.updateSensor()
    }, 1000 * 1800)
  }

  setModel (type) {
    let fl = path.join(__dirname, 'definitions', 'switch_types.json')
    let config = JSON.parse(fs.readFileSync(fl))
    let sensor = config[type]
    if (sensor === undefined) {
      sensor = config.generic
    }
    if (sensor[this.typeId]) {
      this.buttons = sensor[this.typeId]
    } else {
      this.buttons = sensor['*']
    }
  }

  proceedButtons (sensor) {
    let channel = Math.round(sensor.buttonevent / 1000)
    let event = sensor.buttonevent - (channel * 1000)
    let btnE = this.buttons[String(event)]
    switch (btnE) {
      case 'contPress':
        this.conCounter = 0
        this.contPress(channel)
        break
      case 'keyPress_short':
        this.keyPress(channel, 'PRESS_SHORT', true)
        break
      case 'keyPress_long':
        this.keyPress(channel, 'PRESS_LONG', true)
        break
      case 'keyPress_double':
        this.keyPress(channel, 'PRESS_DOUBLE', true)
        break
      case 'keyPress_tripple':
        this.keyPress(channel, 'PRESS_TRIPPLE', true)
        break
      default:
    }
  }

  contPress (channelId) {
    let self = this
    clearInterval(this.tmr)
    this.conCounter = 0
    let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY', channelId)
    this.tmr = setInterval(() => {
      if (self.conCounter < 20) {
        self.conCounter++
        channel.updateValue('PRESS_CONT', 1, true, true)
      } else {
        clearInterval(self.tmr)
      }
    }, 500)
  }

  keyPress (channelId, keyEvent, autoRelease) {
    clearInterval(this.tmr)
    this.log.debug(channelId, keyEvent)
    let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY', channelId)
    this.lastMessage = channelId + ':' + keyEvent
    channel.updateValue(keyEvent, 1, true, true)
    /*
    if (autoRelease) {
      setTimeout(function () {
        channel.updateValue(keyEvent, 0, true)
      }, 500)
    }
    */
  }
}

module.exports = ZHASwitch
