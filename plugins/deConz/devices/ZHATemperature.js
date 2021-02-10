/*
 * File: ZHATemperature.js
 * Project: homematic-virtual-deConz
 * File Created: Thursday, 15th October 2020 9:25:24 pm
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

class ZHAWeatherCombiSensor extends DeConzDevice {
  constructor (plugin, sensor) {
    super(plugin, sensor, 'HM-WDS40-TH-I-2')
    this.sensors = []
    this.addSensor(sensor)
    this.updateSensor()
  }

  updateSensor () {
    let self = this
    let sensor = this.sensors[0]
    this.gateway.refreshSensor(sensor).then(() => {
      let mC = self.hmDevice.getChannelWithTypeAndIndex('MAINTENANCE', 0)
      mC.updateValue('LOWBAT', (sensor.battery < 40), true, true)
    })

    setTimeout(() => {
      self.updateSensor()
    }, 1000 * 1800)
  }

  addSensor (sensor) {
    let self = this
    let channel
    sensor.on('change', () => {
      self.lastMessage = new Date()
      switch (sensor.type) {
        case 'ZHATemperature':
          channel = self.hmDevice.getChannelWithTypeAndIndex('WEATHER', 1)
          let temp = (parseInt(sensor.temperature) / 100)
          self.log.info('Updating Temp %s', temp)
          channel.updateValue('TEMPERATURE', temp, true, true)
          break
        case 'ZHAHumidity':
          channel = self.hmDevice.getChannelWithTypeAndIndex('WEATHER', 1)
          let hum = Math.round(parseInt(sensor.humidity) / 100)
          self.log.info('Updating Humidity %s', hum)
          channel.updateValue('HUMIDITY', hum, true, true)
          break
        case 'ZHAPressure':
          channel = self.hmDevice.getChannelWithTypeAndIndex('WEATHER', 1)
          let pressure = parseInt(sensor.pressure)
          self.log.info('Updating Pressure %s', pressure)
          channel.updateValue('AIRPRESSURE', pressure, true, true)
          break
      }
    })
    this.sensors.push(sensor)
  }
}

module.exports = ZHAWeatherCombiSensor
