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
    super(plugin, light, 'VIR-LG-RGB-DIM')
  }

  async handleCCUEvent (parameter) {
    let changed = await super.handleCCUEvent(parameter)

    var newValue = parameter.newValue
    var channel = this.hmDevice.getChannel(parameter.channel)
    if (parameter.name === 'RGB') {
      let regex = /(\s*[0-9]{1,3}),(\s*[0-9]{1,3}),(\s*[0-9]{1,3})/
      let result = newValue.match(regex)
      let r = parseInt(result[1].trim())
      let g = parseInt(result[2].trim())
      let b = parseInt(result[3].trim())
      this.log.debug('RGB Event (%s,%s,%s)', r, g, b)

      let hsv = this.RGBtoHSV(r, g, b)

      this.log.debug('Converted to HSV %s', JSON.stringify(hsv))
      //      channel.updateValue('RGB', newValue)
      if (!this.currentState === undefined) {
        await this.gateway.updateLightState(this.gwDevice)
        this.currentState = this.gwDevice.lightState
      }
      this.currentState.hue((65536 * hsv.h / 360))
      this.currentState.sat(((hsv.s / 100) * 254))
      changed = true
    }

    if (parameter.name === 'USER_COLOR') {
      this.log.info('VIR-LG_RGB-DIM-CH USER_COLOR %s', newValue)

      this.currentState.hue(this.currentHue)
      this.currentState.sat(this.currentSat)
      channel.updateValue('USER_COLOR', newValue)
      changed = true
    }
    return changed
  }

  handleLightChangeEvent (light) {
    super.handleLightChangeEvent(light, 'VIR-LG_RGB-DIM-CH')
    let state = light.lightState
    let bri = Math.floor(100 / (254 / (state.bri())))
    let hue = Math.floor(360 / (65534 / (state.hue())))
    let sat = Math.floor(100 / (254 / (state.sat())))

    this.log.debug('Current LightState is %s,%s,%s', bri, hue, sat)
    let rgb = this.HSVtoRGB(hue, sat, bri)
    this.log.debug('RGB is %s', JSON.stringify(rgb))
    let cChannel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGB-DIM-CH', '1')
    if (cChannel) {
      let nval = 'rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')'
      this.log.debug('Set %s', nval)
      cChannel.updateValue('RGB', nval, true, true, false, this.eventOwner)
    } else {
      this.log.error('RGB Update Channel %s not found for device %s', 'VIR-LG_RGB-DIM-CH', this.hmDevice)
    }
  }

  RGBtoHSV (r, g, b) {
    var h, s, v
    var max = Math.max(r, g, b)
    var min = Math.min(r, g, b)
    var delta = max - min

    // hue
    if (delta === 0) {
      h = 0
    } else if (r === max) {
      h = ((g - b) / delta) % 6
    } else if (g === max) {
      h = (b - r) / delta + 2
    } else if (b === max) {
      h = (r - g) / delta + 4
    }

    h = Math.round(h * 60)
    if (h < 0) h += 360

    // saturation
    s = Math.round((max === 0 ? 0 : (delta / max)) * 100)

    // value
    v = Math.round(max / 255 * 100)

    return {h: h, s: s, v: v}
  }

  HSVtoRGB (h, s, v) {
    s = s / 100
    v = v / 100
    var c = v * s
    var hh = h / 60
    var x = c * (1 - Math.abs(hh % 2 - 1))
    var m = v - c

    var p = parseInt(hh, 10)
    var rgb = (
      p === 0 ? [c, x, 0]
        : p === 1 ? [x, c, 0]
          : p === 2 ? [0, c, x]
            : p === 3 ? [0, x, c]
              : p === 4 ? [x, 0, c]
                : p === 5 ? [c, 0, x]
                  : []
    )

    return {
      r: Math.round(255 * (rgb[0] + m)),
      g: Math.round(255 * (rgb[1] + m)),
      b: Math.round(255 * (rgb[2] + m))
    }
  }
}

module.exports = ExtendedColorLight
