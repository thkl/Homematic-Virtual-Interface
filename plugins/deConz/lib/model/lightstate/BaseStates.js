const path = require('path')
const States = require(path.join(__dirname, 'States.js'))

module.exports = class BaseStates extends States {
  constructor () {
    super(
      'on',
      'bri',
      'hue',
      'sat',
      'xy',
      'ct',
      'effect',
      'transitiontime',
      Array.from(arguments)
    )
  }

  on (on) {
    if (on !== undefined) {
      return this._setStateValue('on', on)
    } else {
      return this._setStateValue('on', true)
    }
  }

  off () {
    return this._setStateValue('on', false)
  }

  isOn () {
    return this._getStateValue('on')
  }

  bri (value) {
    if (value === undefined) {
      return this._getStateValue('bri')
    } else {
      return this._setStateValue('bri', value)
    }
  }

  hue (value) {
    if (value === undefined) {
      return this._getStateValue('hue')
    } else {
      return this._setStateValue('hue', value)
    }
  }

  sat (value) {
    if (value === undefined) {
      return this._getStateValue('sat')
    } else {
      return this._setStateValue('sat', value)
    }
  }

  xy (x, y) {
    if (Array.isArray(x)) {
      return this._setStateValue('xy', x)
    } else {
      return this._setStateValue('xy', [x, y])
    }
  }

  ct (value) {
    if (value === undefined) {
      return this._getStateValue('ct')
    } else {
      return this._setStateValue('ct', value)
    }
  }

  effect (value) {
    if (value === undefined) {
      return this._getStateValue('effect')
    } else {
      return this._setStateValue('effect', value)
    }
  }

  transitiontime (value) {
    if (value === undefined) {
      return this._getStateValue('transitiontime')
    } else {
      return this._setStateValue('transitiontime', value)
    }
  }

  /**
   * Sets a percentage brightness value
   * @param value
   */
  brightness (value) {
    const bri = this._convertPercentageToStateValue(value, 'bri')
    return this.bri(bri)
  }

  /**
   * Sets a percentage saturation value
   * @param value
   */
  saturation (value) {
    const bri = this._convertPercentageToStateValue(value, 'sat')
    return this.sat(bri)
  }

  effectColorLoop () {
    return this.effect('colorloop')
  }

  effectNone () {
    return this.effect('none')
  }

  transition (value) {
    return this.transitionInMillis(value)
  }

  transitionSlow () {
    return this.transitiontime(8)
  }

  transitionFast () {
    return this.transitiontime(2)
  }

  transitionInstant () {
    return this.transitiontime(0)
  }

  transitionInMillis (value) {
    return this.transitiontime(value / 100)
  }

  transitionDefault () {
    return this.transitiontime(4)
  }

  max (stateName) {
    let stateDefinition = this._getStateDefinition(stateName)
    return stateDefinition.max
  }

  min (stateName) {
    let stateDefinition = this._getStateDefinition(stateName)
    return stateDefinition.min
  }
}
