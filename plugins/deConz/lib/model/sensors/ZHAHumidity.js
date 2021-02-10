
const path = require('path')
const Sensor = require(path.join(__dirname, 'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.uint16({name: 'humidity', defaultValue: 0}),
  types.string({name: 'lastupdated'})
]

module.exports = class ZHAHumidity extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get humidity () {
    return this.getStateAttributeValue('humidity')
  }

  set humidity (value) {
    return this._updateStateAttributeValue('humidity', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)

    if ((newState) && (newState.humidity !== undefined)) {
      let last = this.humidity
      let changed = (last !== newState.humidity)
      this.humidity = newState.humidity
      if (changed === true) {
        this.emit('change')
      }
    }
  }
}
