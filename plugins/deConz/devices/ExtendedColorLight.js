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
const BasicLight = require(path.join(__dirname, 'BasicLight.js'))

class ExtendedColorLight extends BasicLight {
  constructor (plugin, light) {
    super(plugin, light, 'HM-LC-RGBW-WM')
  }

  async handleCCUEvent (parameter) {
    let changed = await super.handleCCUEvent(parameter)

    var newValue = parameter.newValue
    var channel = this.hmDevice.getChannel(parameter.channel)

    if (parameter.name === 'COLOR') {
      if (newValue === 200) {
        this.currentHue = 39609
        this.currentSat = 128
      } else {
        this.currentHue = (newValue / 199) * 65535
        this.currentSat = 254
      }
      this.currentState.hue(this.currentHue)
      this.currentState.sat(this.currentSat)
      channel.updateValue('COLOR', newValue)
      changed = true
    }
    return changed
  }

  handleLightChangeEvent (light) {
    let self = this
    super.handleLightChangeEvent(light)

    let state = light.lightState
    let cChannel = self.hmDevice.getChannelWithTypeAndIndex('RGBW_COLOR', 2)
    cChannel.startUpdating('COLOR')
    cChannel.updateValue('COLOR', Math.round((state.hue() / 65535) * 199))
    cChannel.endUpdating('COLOR')
  }
}

module.exports = ExtendedColorLight
