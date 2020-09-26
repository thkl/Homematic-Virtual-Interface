
const path = require('path')
const Sensor = require(path.join(__dirname,'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

module.exports = class CLIPSensor extends Sensor {
  updateFromGateway (newState) {
    super.updateFromGateway(newState)
  }
}
