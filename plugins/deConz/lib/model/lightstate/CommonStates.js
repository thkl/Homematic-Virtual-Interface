const path = require('path')
const BaseStates = require(path.join(__dirname, 'BaseStates.js'))

class CommonStates extends BaseStates {
  constructor () {
    super(
      'alert',
      Array.from(arguments)
    )
  }

  alert (value) {
    return this._setStateValue('alert', value)
  }

  alertLong () {
    return this.alert('lselect')
  }

  alertShort () {
    return this.alert('select')
  }

  alertNone () {
    return this.alert('none')
  }

  increment (state, inc) {
    let stateDefinition = this._getStateDefinition(state)
    let value = this._getStateValue(state)
    value = value + inc
    if (value > stateDefinition.max) {
      value = stateDefinition.max
    }
    this._setStateValue(state, value)
  }

  decrement (state, inc) {
    let stateDefinition = this._getStateDefinition(state)
    let value = this._getStateValue(state)
    value = value - inc
    if (value < stateDefinition.min) {
      value = stateDefinition.min
    }
    this._setStateValue(state, value)
  }

  incrementBrightness (inc) {
    this.increment('bri', inc)
  }

  decrementBrightness (inc) {
    this.decrement('bri', inc)
  }

  incrementHue (inc) {
    this.increment('hue', inc)
  }

  decrementHue (inc) {
    this.decrement('hue', inc)
  }
}

module.exports = CommonStates
