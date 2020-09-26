
const path = require('path')
const ClipSensor = require(path.join(__dirname,'CLIPSensor.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const STATE_ATTRIBUTES = [
  types.boolean({name: 'presence', defaultValue: false}),
  types.string({name: 'lastupdated'})
]

module.exports = class CLIPPresence extends ClipSensor {
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
