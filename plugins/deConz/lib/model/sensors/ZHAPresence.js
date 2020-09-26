
const path = require('path')
const Sensor = require(path.join(__dirname,'Sensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.boolean({name: 'presence', defaultValue: false}),
  types.string({name: 'lastupdated'})
]

module.exports = class ZHAPresence extends Sensor {
  constructor (id) {
    super(STATE_ATTRIBUTES, id)
  }

  get presence () {
    return this.getStateAttributeValue('presence')
  }

  set presence (value) {
    return this._updateStateAttributeValue('presence', value)
  }

  updateFromGateway (newState) {
    super.updateFromGateway(newState)

    if ((newState) && (newState.presence !== undefined)) {
      let last = this.presence
      let changed = (last !== newState.presence)
      this.presence = newState.presence
      if (changed === true) {
        this.emit('change')
      }
    }
  }
}
