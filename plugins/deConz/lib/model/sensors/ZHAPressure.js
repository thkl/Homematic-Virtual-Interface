
const path = require('path')
const Sensor = require(path.join(__dirname, 'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.uint16({name: 'pressure', defaultValue: 0}),
  types.string({name: 'lastupdated'})
]

module.exports = class ZHAPressure extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get pressure () {
    return this.getStateAttributeValue('pressure')
  }

  set pressure (value) {
    return this._updateStateAttributeValue('pressure', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)

    if ((newState) && (newState.pressure !== undefined)) {
      let last = this.pressure
      let changed = (last !== newState.pressure)
      this.pressure = newState.pressure
      if (changed === true) {
        this.emit('change')
      }
    }
  }
}
