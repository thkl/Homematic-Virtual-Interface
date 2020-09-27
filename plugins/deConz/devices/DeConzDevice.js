/*
 * File: DeConzDevice.js
 * Project: homematic-virtual-deConz
 * File Created: Sunday, 27th September 2020 1:48:28 pm
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

class DeConzDevice {
  constructor (plugin, device, hmType) {
    var devfile = path.join(__dirname, 'definitions', hmType + '.json')
    plugin.server.publishHMDevice(plugin.getName(), hmType, devfile, 1)
    let dSer = 'DEC' + device.uniqueid.substring(13, 22).replace(/[.:#_()-]/g, '')
    this.hmDevice = plugin.bridge.initDevice(plugin.getName(), dSer, hmType, dSer)
    this.gwDevice = device
    this.log = plugin.log
    this.plugin = plugin
    this.gateway = plugin.gateway
    this.log.debug('adding %s of type %s', dSer, hmType)
  }
}

module.exports = DeConzDevice
