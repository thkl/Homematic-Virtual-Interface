
const path = require('path')
const Sensor = require(path.join(__dirname,'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.uint16({name: 'buttonevent'}),
  types.string({name: 'lastupdated'})
]

module.exports = class ZHASwitch extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get buttonevent () {
    return this.getStateAttributeValue('buttonevent')
  }

  set buttonevent (value) {
    return this._updateStateAttributeValue('buttonevent', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)
    if ((newState) && (newState.buttonevent !== undefined)) {
      this.buttonevent = newState.buttonevent
      this.emit('change')
    }
  }
}
