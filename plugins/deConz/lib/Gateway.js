const http = require('http')
const WebSocket = require('ws')
const path = require('path')
const fs = require('fs')

module.exports = class Gateway {
  constructor (host, port,log) {
    log.info('Booting up gateway')
    this.host = host
    this.port = port
    this.timeout = 10
    this.sensors = []
    this.lights = []
    this.log = log || console.log
  }

  setApikey (key) {
    this.key = key
  }

  apiCall (type, method, data) {
    let self = this
    return new Promise((resolve, reject) => {
      let urlPath = '/api/'
      if (self.key) {
        urlPath = urlPath + self.key + '/'
      }
      urlPath = urlPath + method

      let headers = {}
      let bodyMsg
      if (data) {
        if (typeof data === 'string') {
          bodyMsg = data
        } else {
          bodyMsg = JSON.stringify(data)
        }
        headers['Content-Type'] = 'application/json'
        headers['Content-Length'] = bodyMsg.length
      }

      let options = {
        host: self.host,
        port: self.port,
        method: type,
        path: urlPath,
        headers: headers
      }

      let request = http.request(options, (res) => {
        var data = ''
        res.setEncoding('binary')

        res.on('data', (chunk) => {
          data += chunk.toString()
        })

        res.on('end', () => {
          // JSONify this
          if ((res.headers) && (res.headers['content-type'].indexOf('application/json') !== -1)) {
            resolve(JSON.parse(data))
          } else {
            resolve(data)
          }
        })
      })

      request.on('error', (e) => {
        reject(e)
      })

      request.on('timeout', (e) => {
        request.destroy()
        reject(new Error('TimeOut'))
      })

      request.setTimeout(self.timeout * 1000)
      if (bodyMsg) {
        request.write(bodyMsg)
      }
      request.end()
    })
  }

  getJSON (strJson) {
    try {
      return JSON.parse(strJson)
    } catch (e) {
      return {error: e}
    }
  }

  getConfig () {
    let self = this
    return new Promise((resolve, reject) => {
      self.apiCall('GET', 'config', undefined).then((result, error) => {
        if (error) {
          reject(error)
        } else {
          self.gwConfiguration = result
          resolve(self.gwConfiguration)
        }
      })
    })
  }

  getSensor (id) {
    const sendorId = id.id || id
    const found = this.sensors.filter(sensor => sensor.id === parseInt(sendorId))
    return found[0]
  }

  getSensors () {
    return this.sensors
  }

  _addNewSensor (id, sensorData) {
    let type = sensorData.type
    let sensor
    this.log.debug(sensorData.config)
    let clazzFile = path.join(__dirname, 'model', 'sensors', type + '.js')
    if (fs.existsSync(clazzFile)) {
      let SensorClazz = require(clazzFile)
      sensor = new SensorClazz(id)
      sensor._populate(sensorData)
      this.sensors.push(sensor)
    } else {
      this.log.warn('No Definition for Sensor %s', type)
    }
  }

  fetchSensors () {
    let self = this
    return new Promise((resolve, reject) => {
      self.apiCall('GET', 'sensors', undefined).then((result, error) => {
        if (error) {
          reject(error)
        } else {
          if (result) {
            Object.keys(result).map((id) => {
              let sensor = self.getSensor(id)
              if (!sensor) { // check if we have this sensor allready .. if not add it
                self._addNewSensor(id, result[id])
              } else {
                sensor._populate(result[id])
              }
            })
          }
          self.log.debug('%s sensors processed', self.sensors.length)
          resolve(self.sensors)
        }
      })
    })
  }

  getLight (id) {
    const lightId = id.id || id
    const found = this.lights.filter(light => light.id === parseInt(lightId))
    return found[0]
  }

  getLights () {
    return this.lights
  }

  _addNewLight (id, lightData) {
    let self = this
    let light
    let clazzFile = path.join(__dirname, 'model', 'lights', 'Light.js')
    let LightClazz = require(clazzFile)
    light = new LightClazz(id)
    light._populate(lightData)
    light.on('lightstatechanged', (newState) => {
      let pl = newState.getReducedPayload()
      self.apiCall('PUT', 'lights/' + light.id + '/state', pl).then((result, error) => {
        if (error) {
          console.log(error)
        }
      })
    })
    this.lights.push(light)
  }

  fetchLights () {
    let self = this
    return new Promise((resolve, reject) => {
      self.apiCall('GET', 'lights', undefined).then((result, error) => {
        if (error) {
          reject(error)
        } else {
          Object.keys(result).map((id) => {
            let light = self.getLight(id)
            if (!light) { // check if we have this light allready .. if not add it
              self._addNewLight(id, result[id])
            } else {
              light._populate(result[id])
            }
          })
          self.log.debug('%s lights added', self.lights.length)
          resolve(self.lights)
        }
      })
    })
  }

  _parseEvent (event) {
    if (event) {
      if ((event.id) && (event.t) && (event.e) && (event.r)) {
        if ((event.e === 'changed') && (event.t === 'event')) {
          //          console.log(event.r)
          switch (event.r) {
            case 'sensors':
              {
                let sensor = this.getSensor(event.id)
                if (sensor) {
                  sensor.updateFromGateway(event.state)
                } else {
                  this.log.warn('sensor %s not found in local database', event.id)
                }
              }

              break
            case 'lights':
              let light = this.getLight(event.id)
              if (light) {
                light.state = event.state
              } else {
                this.log.warn('light %s not found', event.id)
              }
              break
          }
        }
      }
    }
  }

  _connectGateway () {
    let self = this
    if ((this.gwConfiguration) && (this.gwConfiguration.websocketport)) {
      try {
        this.ws = new WebSocket('ws://' + this.host + ':' + this.gwConfiguration.websocketport)

        this.ws.onerror = (e) => {
          self.log.error('websocket error reconnecting in 10 ...')
          setTimeout(() => {
            self._connectGateway()
          }, 10000)
        }

        this.ws.onopen = () => {
          self.log.debug('socket connection established')
        }

        this.ws.onlcose = () => {
          self.log.info('socked closed')
          if (self.autoReconnect) {
            setTimeout(() => {
              self._connectGateway()
            }, 10000)
          }
        }

        this.ws.onmessage = (msg) => {
          try {
            let oMsg = JSON.parse(msg.data)
            if (oMsg) {
              self._parseEvent(oMsg)
            }
          } catch (e) {
            self.log.error('Error %s', e)
          }
        }
      } catch (e) {
      
      }
    } else {
      self.log.error('unable to connect to socked server')
    }
  }

  shutdown () {
    if (this.ws) {
      this.log.info('Closing Websockets %s', this.ws.readyState)
      if (this.ws.readyState === 1) {
        this.ws.terminate()
        this.ws.close()
      }
    }
  }

  async connect (callback) {
    if (!(this.gwConfiguration) || (!this.gwConfiguration.websocketport)) {
      await this.getConfig()
      await this.fetchSensors()
      await this.fetchLights()
    }
    this.log.info('Connecting to websocket')
    this._connectGateway(callback)
  }
}
