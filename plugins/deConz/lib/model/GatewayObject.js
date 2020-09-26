const path = require('path')
const ApiError = require(path.join(__dirname, '..', 'ApiError.js'))
const EventEmitter = require('events')

module.exports = class GatewayObject extends EventEmitter {
  constructor (attributes) {
    super()
    this._attributes = {}
    this._data = {}

    attributes.forEach(attr => {
      this._attributes[attr.name] = attr
    })
  }

  _populate (data) {
    const self = this

    if (data) {
      Object.keys(data).forEach(key => {
        if (self._attributes[key]) {
          self.setAttributeValue(key, data[key])
        }
      })
    }

    this._populationData = data
    return self
  }

  getAttributeValue (name) {
    const definition = this._attributes[name]

    if (definition) {
      return definition.getValue(this._data[name])
    } else {
      throw new ApiError(`Requesting value for invalid attribute '${name}'`)
    }
  }

  setAttributeValue (name, value) {
    const definition = this._attributes[name]

    if (definition) {
      this._data[definition.name] = definition.getValue(value)
    } else {
      throw new ApiError(`Attempted to set attribute '${name}', but do not have a definition registered`)
    }

    return this
  }

  toString () {
    return `${this.constructor.name}`
  }
}
