const { timingSafeEqual } = require('crypto')
/*
 * File: ExtendedColorLight.js
 * Project: homematic-virtual-deConz
 * File Created: Sunday, 27th September 2020 1:44:28 pm
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

class BasicLight extends DeConzDevice {
  constructor (plugin, light, hmType = 'HM-LC-Dim1T-Pl') {
    super(plugin, light, hmType)
    let self = this
    this.defaultTransitiontime = 0.5
    this.transitiontime = 0.5

    light.on('change', () => {
      self.handleLightChangeEvent(light)
    })

    self.hmDevice.on('device_channel_value_change', async (parameter) => {
      if (await self.handleCCUEvent(parameter)) {
        self.gwDevice.lightState = self.currentState
      }
    })
    // set the new Values at init
    light.emit('change')
  }

  async handleCCUEvent (parameter) {
    let self = this
    var newValue = parameter.newValue
    var channel = this.hmDevice.getChannel(parameter.channel)
    this.log.debug('CCU Event on %s -  %s with %s', this.hmDevice.serialNumber, parameter.name, newValue)
    this.log.debug('Get Current state')
    await this.gateway.updateLightState(this.gwDevice)
    this.currentState = this.gwDevice.lightState
    this.log.debug('Get Current state done ')
    var changed = false

    if (parameter.name === 'INSTALL_TEST') {
      let max = this.currentState.max('bri')
      let min = this.currentState.min('bri')
      this.currentState.on()
      this.currentState.bri(max)
      changed = true

      setTimeout(function () {
        this.currentState.bri(min)
        this.currentState.off()
        self.gwDevice.lightState = this.currentState
      }, 1000)
    }

    if (parameter.name === 'LEVEL') {
      this.setLevel(channel, newValue)
      changed = true
    }

    if ((parameter.name === 'RAMP_TIME') && (channel.index === '1')) {
      this.transitiontime = newValue * 10
      channel.updateValue('RAMP_TIME', newValue, true, true)
    }

    if (parameter.name === 'OLD_LEVEL') {
      if (newValue === true) {
        this.log.debug('Recovering old level')
        if (this.oldLevel === undefined) {
          this.oldLevel = 1
          this.log.debug('No old level found set to 1')
        }
        channel.updateValue('OLD_LEVEL', true)
        this.setLevel(channel, this.oldLevel)
      }
      changed = true
    }
    return changed
  }

  setLevel (channel, newLevel) {
    this.log.debug('Set new Level %s', newLevel)
    let max = this.currentState.max('bri')
    let min = this.currentState.min('bri')
    let value = (newLevel * max)
    if (value < min) {
      value = min
    }
    this.log.debug('Set Brightness %s', value)
    this.currentState.bri(value)

    if (value > min) {
      this.currentState.on()
      // We have to Send hue and sat cause they may have changed in off state
      if (this.currentSat) {
        this.currentState.sat(this.currentSat)
      }
      if (this.currentHue) {
        this.currentState.hue(this.currentHue)
      }
    } else {
      this.currentState.off()
    }
    this.currentState.transitiontime(this.transitiontime * 10)
    this.log.debug('Update Channel %s With Level %s', channel.address, newLevel)
    channel.updateValue('LEVEL', newLevel, true, true)
    if (newLevel > 0) {
      this.oldLevel = newLevel
    }
  }

  handleLightChangeEvent (light, dimmerChannel = 'DIMMER') {
    let self = this
    this.log.debug('Gateway Event %s', JSON.stringify(light.lightState))
    // Check what was changed
    let state = light.lightState
    // fest set the brightness
    let bChannel = self.hmDevice.getChannelWithTypeAndIndex(dimmerChannel, 1)
    bChannel.startUpdating('LEVEL')
    if (state.isOn()) {
      let bri = state.bri()
      let max = state.max('bri')
      bChannel.updateValue('LEVEL', Number((bri / max).toFixed(2)), true, true)
    } else {
      bChannel.updateValue('LEVEL', 0, true, true)
    }
    bChannel.endUpdating('LEVEL')
  }
}

module.exports = BasicLight
