const path = require('path')
const LightState = require('../lightstate/LightState')
const GatewayObjectWithId = require(path.join(__dirname, '..', 'GatewayObjectWithId.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))

const ATTRIBUTES = [
  types.uint16({name: 'id'}),
  types.string({name: 'name', min: 0, max: 32}),
  types.string({name: 'type'}),
  types.string({name: 'modelid'}),
  types.string({name: 'manufacturername'}),
  types.string({name: 'uniqueid'}),
  types.object({name: 'colorcapabilities'}),
  types.object({name: 'config'}),
  types.string({name: 'swversion'}),
  types.uint16({name: 'ctmax'}),
  types.uint16({name: 'ctmin'}),
  types.boolean({name: 'hascolor'})
]

module.exports = class Light extends GatewayObjectWithId {
  constructor (id) {
    super(ATTRIBUTES, id)
    this._lightState = null
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
  get productname () {
    return this.getAttributeValue('productname')
  }
  get swversion () {
    return this.getAttributeValue('swversion')
  }

  get lightState () {
    return this._lightState
  }

  set lightState (newState) {
    if (newState instanceof LightState) {
      this._lightState = newState
    } else {
      this._populateState(newState)
    }
    // send this to the Gateway
    this.emit('lightstatechanged', this._lightState)
  }

  _populate (light) {
    super._populate(light)
    if (light.state) {
      this._populateState(light.state)
    }
  }

  _populateState (newState) {
    let ls = new LightState()
    ls.populate(newState)
    this._lightState = ls
    return ls
  }
}
