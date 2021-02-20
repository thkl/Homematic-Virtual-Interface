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
const LightState = require(path.join(__dirname, '..', 'lib', 'model', 'lightstate', 'LightState.js'))
class BasicLight extends DeConzDevice {
  constructor (plugin, light, hmType = 'HM-LC-Dim1T-Pl') {
    super(plugin, light, hmType)
    let self = this
    this.defaultTransitiontime = 0.5
    this.transitiontime = 0.5
    this.hasTestMode = true
    this.eventOwner = 'deConz'

    light.on('change', () => {
      self.lastMessageTime = new Date()
      self.handleLightChangeEvent(light)
    })

    if (this.hmDevice === undefined) {
      this.log.error('Error while initializing Light %s', light)
    }
    this.hmDevice.on('device_channel_value_change', async (parameter) => {
      if ((parameter.name !== 'WORKING') && (parameter.eventOwner !== self.eventOwner)) { // Do not react on own events
        if (await self.handleCCUEvent(parameter)) {
          self.log.debug('Set New LightState %s', JSON.stringify(self.currentState))
          self.gwDevice.lightState = self.currentState
        }
      }
    })

    this.hmDevice.on('device_channel_install_test', async (parameter) => {
      self.test()
    })
    // set the new Values at init
    this.gateway.updateLightState(this.gwDevice).then(newState => {
      self.currentState = newState
    })
  }

  test () {
    let newState = new LightState()
    newState.alert('select')
    this.log.info('Send New Lightstate %s', JSON.stringify(newState))
    this.gwDevice.lightState = newState
  }

  async handleCCUEvent (parameter) {
    let changed = false
    var newValue = parameter.newValue
    var channel = this.hmDevice.getChannel(parameter.channel)

    this.log.debug('CCU Event on %s -  %s with %s', this.hmDevice.serialNumber, parameter.name, newValue)

    if (parameter.name === 'INSTALL_TEST') {
      this.test()
      changed = false
      channel.updateValue('INSTALL_TEST', true, true, true, this.eventOwner)
    }

    if (parameter.name === 'LEVEL') {
      await this.setLevel(channel, newValue)
      this.transitiontime = this.defaultTransitiontime
      changed = true
    }

    if ((parameter.name === 'RAMP_TIME') && (channel.index === '1')) {
      this.transitiontime = newValue
      channel.updateValue('RAMP_TIME', newValue, true, true, false, this.eventOwner)
    }

    if (parameter.name === 'OLD_LEVEL') {
      if (newValue === true) {
        this.log.debug('Recovering old level')
        if (this.oldLevel === undefined) {
          this.oldLevel = 1
          this.log.debug('No old level found set to 1')
        }
        channel.updateValue('OLD_LEVEL', true, false, false, this.eventOwner)
        this.setLevel(channel, this.oldLevel)
      }
      changed = true
    }
    return changed
  }

  setLevel (channel, newLevel) {
    let self = this
    return new Promise(async (resolve, reject) => {
      self.log.debug('Set new Level %s', newLevel)
      self.log.debug('Get Current state')
      await self.gateway.updateLightState(self.gwDevice)
      self.currentState = self.gwDevice.lightState
      self.log.debug('Get Current state done ')

      let max = self.currentState.max('bri')
      let min = self.currentState.min('bri')
      self.log.debug('Min is %s max is %s', min, max)
      let value = (newLevel * max)
      if (value < min) {
        value = min
      }
      self.log.debug('Set Brightness %s', value)
      self.currentState.bri(value)

      if (value > min) {
        self.log.debug('Set On')
        self.currentState.on()
        // We have to Send hue and sat cause they may have changed in off state
        if (self.currentSat) {
          self.currentState.sat(self.currentSat)
        }
        if (self.currentHue) {
          self.currentState.hue(self.currentHue)
        }
      } else {
        self.currentState.off()
      }
      self.currentState.transitiontime(self.transitiontime * 10)
      self.log.debug('Update Channel %s With Level %s', channel.address, newLevel)
      channel.updateValue('LEVEL', newLevel, true, true, true, self.eventOwner)
      if (newLevel > 0) {
        self.oldLevel = newLevel
      }
      self.log.debug('NewState is %s', JSON.stringify(self.currentState))
      resolve()
    })
  }

  handleLightChangeEvent (light, dimmerChannel = 'DIMMER') {
    let self = this
    this.log.debug('Gateway Event %s', JSON.stringify(light.lightState))
    // Check what was changed
    let state = light.lightState
    // fest set the brightness
    this.log.debug('Updating Channel %s', dimmerChannel)
    let bChannel = self.hmDevice.getChannelWithTypeAndIndex(dimmerChannel, 1)
    if (bChannel) {
      if (state.isOn()) {
        let bri = state.bri()
        let max = state.max('bri')
        this.log.debug('Send ChannelUpdate %s', dimmerChannel)
        bChannel.updateValue('LEVEL', Number((bri / max).toFixed(2)), true, true, true, this.eventOwner)
      } else {
        this.log.debug('Send ChannelUpdate  %s', dimmerChannel)
        bChannel.updateValue('LEVEL', 0, true, true, true, this.eventOwner)
      }
    } else {
      this.log.error('Channel not found %s', dimmerChannel)
    }
  }
}

module.exports = BasicLight
