
const path = require('path')
const Sensor = require(path.join(__dirname,'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.int16({name: 'status'}),
  types.string({name: 'lastupdated'})
]

module.exports = class CLIPGenericStatus extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get status () {
    return this.getStateAttributeValue('status')
  }

  set status (value) {
    return this._updateStateAttributeValue('status', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)

    if ((newState) && (newState.status !== undefined)) {
      let last = this.status
      let changed = (last !== newState.status)
      this.status = newState.status
      if (changed === true) {
        this.emit('change')
      }
    }
  }
}
