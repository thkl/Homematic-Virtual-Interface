
const path = require('path')
const Sensor = require(path.join(__dirname,'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.boolean({name: 'daylight'}),
  types.string({name: 'lastupdated'})
]

module.exports = class Daylight extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }
}
