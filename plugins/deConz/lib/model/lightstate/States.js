const path = require('path')
const LIGHT_STATE_PARAMETERS = require(path.join(__dirname, 'StateParameters.js'))
const types = require(path.join(__dirname, '..', '..', 'types', 'Types.js'))
const ApiError = require(path.join(__dirname, '..', '..', 'ApiError.js'))
const util = require(path.join(__dirname, '..', '..', 'util.js'))

const PERCENTAGE = types.uint8({name: 'percentage', min: 0, max: 100})
const DEGREES = types.uint8({name: 'degrees', min: 0, max: 360})

module.exports = class States {
  constructor () {
    if (arguments.length === 0) {
      throw new ApiError('You must provide some Light State Attributes')
    }

    const states = {}

    function appendStateParameter (name) {
      const parameter = LIGHT_STATE_PARAMETERS[name]
      if (!parameter) {
        throw new ApiError(`Unknown Light State Parameter: "${name}"`)
      }
      states[name] = parameter
    }

    const argsArray = util.mergeArrays(Array.from(arguments))
    argsArray.forEach(state => {
      if (Array.isArray(state)) {
        state.forEach(appendStateParameter)
      } else {
        appendStateParameter(state)
      }
    })

    this._allowedStates = states
    this._state = {}
    this.changedStates = []
  }

  reset () {
    this._state = {}
    return this
  }

  getPayload () {
    return Object.assign({}, this._state)
  }

  getReducedPayload (reset) {
    let self = this
    let pl = this.getPayload()
    Object.keys(pl).map(key => {
      if (self.changedStates.indexOf(key) === -1) {
        delete pl[key]
      }
    })
    if (reset) {
      this.changedStates = []
    }
    return pl
  }

  getAllowedStateNames () {
    const names = []

    Object.keys(this._allowedStates).forEach(stateDefinition => {
      names.push(stateDefinition)
    })

    return names
  }

  _getStateDefinition (name) {
    return this._allowedStates[name]
  }

  populate (data) {
    const self = this

    if (data) {
      Object.keys(data).forEach(key => {
        if (self._allowedStates[key]) {
          self._setStateValue(key, data[key])
        }
      })
    }
    this.changedStates = []
    return self
  }

  _getStateValue (definitionName) {
    return this._state[definitionName]
  }

  _setStateValue (definitionName, value) {
    const self = this
    const stateDefinition = self._allowedStates[definitionName]

    if (stateDefinition) {
      this._state[definitionName] = stateDefinition.getValue(value)
      this.changedStates.push(definitionName)
    } else {
      throw new ApiError(`Attempted to set a state '${definitionName}' that is not one of the allowed states`)
    }

    return self
  }

  _convertPercentageToStateValue (value, stateName, isFloat) {
    return this._convertToStateValue(PERCENTAGE, value, stateName, isFloat)
  }

  _convertDegreesToStateValue (value, stateName, isFloat) {
    return this._convertToStateValue(DEGREES, value, stateName, isFloat)
  }

  _convertToStateValue (range, value, stateName, isFloat) {
    const stateDefinition = this._allowedStates[stateName]
    const validatedValue = range.getValue(value)

    if (validatedValue === range.getMinValue()) {
      return stateDefinition.getMinValue()
    } else if (validatedValue === range.getMaxValue()) {
      return stateDefinition.getMaxValue()
    } else {
      if (isFloat) {
        return (stateDefinition.getRange() * validatedValue) / range.getMaxValue()
      }
      return Math.round((stateDefinition.getRange() * validatedValue) / range.getMaxValue())
    }
  }
}
