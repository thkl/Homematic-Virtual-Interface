const path = require('path')
const GatewayObjectWithId = require(path.join(__dirname, '..', 'GatewayObjectWithId.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))
const util = require(path.join(__dirname, '..', '..', 'util.js'))

const COMMON_ATTRIBUTES = [
  types.int8({name: 'id'}),
  types.string({name: 'name'}),
  types.string({name: 'type'}),
  types.string({name: 'modelid'}),
  types.string({name: 'manufacturername'}),
  types.string({name: 'uniqueid'}),
  types.string({name: 'swversion'})
]

const COMMON_STATE_ATTRIBUTES = [
  types.string({name: 'lastupdated', defaultValue: 'none'})
]

module.exports = class Sensor extends GatewayObjectWithId {
  constructor (stateAttributes, id) {
    const stateAttribute = types.object({
      name: 'state',
      types: util.mergeArrays(COMMON_STATE_ATTRIBUTES, stateAttributes)
    })

    const allAttributes = util.mergeArrays(COMMON_ATTRIBUTES, stateAttribute)

    super(allAttributes, id)

    this._stateAttributes = {}
    stateAttribute.types.forEach(attr => {
      this._stateAttributes[attr.name] = attr
    })
  }

  get id () {
    return this.getAttributeValue('id')
  }
  get name () {
    return this.getAttributeValue('name')
  }
  set name (value) {
    return this.setAttributeValue('name', value)
  }
  get type () {
    return this.getAttributeValue('type')
  }
  get modelid () {
    return this.getAttributeValue('modelid')
  }
  get manufacturername () {
    return this.getAttributeValue('manufacturername')
  }
  get uniqueid () {
    return this.getAttributeValue('uniqueid')
  }

  get swversion () {
    return this.getAttributeValue('swversion')
  }

  getStateAttribute (name) {
    return this._stateAttributes[name]
  }

  getStateAttributeNames () {
    return Object.keys(this._stateAttributes)
  }

  getStateAttributeValue (name) {
    const state = this.getAttributeValue('state')
    const definition = this.getStateAttribute(name)

    if (definition) {
      return definition.getValue(state[name])
    } else {
      const value = state[name]
      if (value !== undefined) {
        return value
      }
    }

    return null
  }

  updateFromGateway (newState) {
    if ((newState) && (newState.lastupdated !== undefined)) {
      this._updateStateAttributeValue('lastupdated', newState.lastupdated)
    }
  }

  _updateStateAttributeValue (name, value) {
    let state = this.getAttributeValue('state') || {}
    state[name] = value
    return this.setAttributeValue('state', state)
  }
}
