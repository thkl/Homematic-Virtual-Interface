
const path = require('path')
const Sensor = require(path.join(__dirname, 'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.uint16({name: 'temperature', defaultValue: 0}),
  types.string({name: 'lastupdated'})
]

module.exports = class ZHATemperature extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get temperature () {
    return this.getStateAttributeValue('temperature')
  }

  set temperature (value) {
    return this._updateStateAttributeValue('temperature', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)

    if ((newState) && (newState.temperature !== undefined)) {
      let last = this.temperature
      let changed = (last !== newState.temperature)
      this.temperature = newState.temperature
      if (changed === true) {
        this.emit('change')
      }
    }
  }
}
