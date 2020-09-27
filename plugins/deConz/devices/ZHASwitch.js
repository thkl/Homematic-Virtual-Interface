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
const DeConzDevice = require(path.join(__dirname, 'DeConzDevice.js'))

class ZHASwitch extends DeConzDevice {
  constructor (plugin, sensor) {
    super(plugin, sensor, 'HM-RC-8')
    let self = this
    sensor.on('change', () => {
      switch (sensor.buttonevent) {
        case 1001:
          self.contPress(1)
          break
        case 1002:
          self.keyPress(1, 'PRESS_SHORT', true)
          break
        case 1003:
          self.keyPress(1, 'PRESS_LONG', true)
          self.keyPress(1, 'PRESS_LONG_RELEASE', true)
          break

        case 2001:
          self.contPress(2)
          break
        case 2002:
          self.keyPress(2, 'PRESS_SHORT', true)
          break
        case 2003:
          self.keyPress(2, 'PRESS_LONG', true)
          self.keyPress(2, 'PRESS_LONG_RELEASE', true)
          break

        case 3001:
          self.contPress(3)
          break
        case 3002:
          self.keyPress(3, 'PRESS_SHORT', true)
          break
        case 3003:
          self.keyPress(3, 'PRESS_LONG', true)
          self.keyPress(3, 'PRESS_LONG_RELEASE', true)
          break
        case 4001:
          self.contPress(4)
          break
        case 4002:
          break
        case 4003:
          self.keyPress(4, 'PRESS_LONG', true)
          self.keyPress(4, 'PRESS_LONG_RELEASE', true)
          break

        case 5001:
          self.contPress(5)
          break
        case 5002:
          self.keyPress(5, 'PRESS_SHORT', true)
          break
        case 5003:
          self.keyPress(5, 'PRESS_LONG', true)
          self.keyPress(5, 'PRESS_LONG_RELEASE', true)
          break
      }
    })
  }

  contPress (channelId) {
    clearInterval(this.tmr)
    let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY', channelId)
    this.tmr = setInterval(() => {
      channel.updateValue('PRESS_CONT', 1, true, true)
    }, 500)
  }

  keyPress (channelId, keyEvent, autoRelease) {
    clearInterval(this.tmr)
    let channel = this.hmDevice.getChannelWithTypeAndIndex('KEY', channelId)
    channel.updateValue(keyEvent, 1, true, true)
    if (autoRelease) {
      setTimeout(function () {
        channel.updateValue(keyEvent, 0, true)
      }, 500)
    }
  }
}

module.exports = ZHASwitch
