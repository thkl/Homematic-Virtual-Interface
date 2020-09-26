const path = require('path')
const ApiError = require(path.join(__dirname, '..', 'ApiError.js'))

class Type {
  static isValueDefined (value) {
    return value !== null && value !== undefined && value !== Number.NaN
  }

  constructor (config) {
    if (!config.name) {
      throw new ApiError('A name must be specified')
    }
    this._name = config.name

    if (!config.type) {
      throw new ApiError('A type must be specified')
    }
    this._type = config.type

    // Optional configuration values
    this._optional = Type.isValueDefined(config.optional) ? config.optional : true
    this._defaultValue = Type.isValueDefined(config.defaultValue) ? config.defaultValue : null // null is considered unset in a Type
  }

  get name () {
    return this._name
  }

  get type () {
    return this._type
  }

  get defaultValue () {
    return this._defaultValue
  }

  get optional () {
    return this._optional
  }

  hasDefaultValue () {
    return Type.isValueDefined(this.defaultValue)
  }

  getValue (val) {
    if (Type.isValueDefined(val)) {
      return this._convertToType(val)
    } else {
      if (this.hasDefaultValue()) {
        return this._convertToType(this.defaultValue)
      } else {
        if (this.optional) {
          // Value not defined (i.e. null or undefined or Number.NaN)
          return null
        } else {
          throw new ApiError(`No value provided and '${this.name}' is not optional`)
        }
      }
    }
  }

  _convertToType (val) {
    return val
  }
}

class ListType extends Type {
  constructor (config) {
    if (config.minEntries === null || config.minEntries === undefined) {
      throw new ApiError('minEntries is required for a list type')
    }

    // if (props.maxEntries === null || props.maxEntries === undefined) {
    //   throw new ApiError('maxEntries is required for a list type');
    // }

    super(Object.assign({type: 'list'}, config))
    this.minEntries = config.minEntries
    this.maxEntries = config.maxEntries

    const type = config.listType
    if (!(type instanceof Type)) {
      throw new ApiError(`listType must be an instance of a Type, not ${type}`)
    }
    this._listType = type
  }

  get listType () {
    return this._listType
  }

  getValue () {
    const listValues = super.getValue.apply(this, Array.from(arguments))

    if (!Type.isValueDefined(listValues)) {
      // Validate the min entries requirement is met
      if (this.minEntries === 0) {
        return listValues
      } else {
        throw new ApiError(`Type ${this.name}, minEntries requirement not satisfied, required ${this.minEntries}, but have null object`)
      }
    }

    // Value is defined, so validate it according to specification
    const length = listValues.length
    if (length < this.minEntries) {
      throw new ApiError(`The number of entries for the list, "${length}" is less than required minimum of ${this.minEntries}`)
    }

    if (this.maxEntries && length > this.maxEntries) {
      throw new ApiError(`The number of entries for the list, ${length}, is greater than required maximum of ${this.maxEntries}`)
    }

    return listValues
  }

  _convertToType (val) {
    if (!Type.isValueDefined(val)) {
      return null
    }

    const result = []
    const type = this.listType

    if (Array.isArray(val)) {
      val.forEach(value => {
        result.push(type.getValue(value))
      })
    } else {
      result.push(type.getValue(val))
    }

    return result
  }
}

class RangedNumberType extends Type {
  constructor (config, typeMin, typeMax) {
    super(config)

    if (Type.isValueDefined(config.min)) {
      this.min = config.min
    } else {
      this.min = typeMin
    }

    if (Type.isValueDefined(config.max)) {
      this.max = config.max
    } else {
      this.max = typeMax
    }
  }

  getValue (value) {
    const numberValue = super.getValue(value)

    // Value has been checked in the super function and is optional
    if (numberValue === null) {
      return null
    }

    // Invalid input value
    if (Number.isNaN(numberValue)) {
      throw new ApiError(`Failure to convert value for ${this.name}, value, '${value}' is not a parsable number'`)
    }

    if (this.isValueInRange(numberValue)) {
      return numberValue
    } else {
      throw new ApiError(`Value, '${numberValue}' is not within allowed limits: min=${this.getMinValue()} max=${this.getMaxValue()} for '${this.name}'`)
    }
  }

  _convertToType (val) {
    return Number(val)
  }

  isValueInRange (value) {
    return value >= this.getMinValue() && value <= this.getMaxValue()
  }

  getMinValue () {
    return this.min
  }

  getMaxValue () {
    return this.max
  }

  // TODO check this is still in use
  getRange () {
    // return this.max - this.min; //TODO brightness has a lower bound of 1, which can generate quirks
    return this.max
  }
}

class ChoiceType extends Type {
  constructor (config) {
    super(Object.assign({type: 'choice'}, config))

    const validValues = config.validValues
    if (!Type.isValueDefined(validValues)) {
      throw new ApiError('validValues config property is required for choice type')
    }
    this._allowedValues = validValues
  }

  get validValues () {
    return this._allowedValues
  }

  _convertToType (val) {
    if (this.validValues.indexOf(val) > -1) {
      return val
    } else {
      throw new ApiError(`Value '${val}' is not one of the allowed values [${this.validValues}]`)
    }
  }
}

class FloatType extends RangedNumberType {
  constructor (config) {
    super(Object.assign({type: 'float'}, config), -Number.MAX_VALUE, Number.MAX_VALUE)
  }
}

class Int8Type extends RangedNumberType {
  constructor (config) {
    super(Object.assign({type: 'int8'}, config), -255, 255)
  }

  _convertToType (val) {
    return parseInt(val)
  }
}

class UInt8Type extends RangedNumberType {
  constructor (config) {
    super(Object.assign({type: 'uint8'}, config), 0, 255)
  }

  _convertToType (val) {
    return parseInt(val)
  }
}

class StringType extends Type {
  constructor (config) {
    super(Object.assign({type: 'string'}, config))

    if (Type.isValueDefined(config.min)) {
      this.min = config.min
    } else {
      this.min = null
    }

    if (Type.isValueDefined(config.max)) {
      this.max = config.max
    } else {
      this.max = null
    }
  }

  get minLength () {
    return this.min
  }

  get maxLength () {
    return this.max
  }

  getValue (value) {
    const checkedValue = super.getValue(value)
    const isValueDefined = Type.isValueDefined(checkedValue)
    const optional = this.optional

    // If we are optional and have no value, prevent further checks as they will fail
    if (optional && !isValueDefined) {
      return checkedValue
    }

    // 0 will not trigger this, but it is not a problem in this context
    if (this.minLength) {
      if (!isValueDefined) {
        throw new ApiError(`No value provided for ${this.name}, must have a minimum length of ${this.minLength}`)
      } else if (checkedValue.length < this.min) {
        throw new ApiError(`'${value}' for ${this.name}, does not meet minimum length requirement of ${this.minLength}`)
      }
    }

    // 0 will not trigger this, but it is not a problem in this context, although max length of 0 is not really valid
    if (this.maxLength) {
      if (isValueDefined && checkedValue.length > this.maxLength) {
        throw new ApiError(`'${value}' for ${this.name}, does not meet maximum length requirement of ${this.maxLength}`)
      }
    }
    return checkedValue
  }

  _convertToType (val) {
    return `${val}`
  }
}

class UInt16Type extends RangedNumberType {
  constructor (config) {
    super(Object.assign({type: 'uint16'}, config), 0, 65535)
  }

  _convertToType (val) {
    return parseInt(val)
  }
}

class BooleanType extends Type {
  constructor (config) {
    super(Object.assign({type: 'boolean'}, config))
  }

  getValue (val) {
    if (Type.isValueDefined(val)) {
      return Boolean(val)
    } else {
      if (this.hasDefaultValue()) {
        return Boolean(this.defaultValue)
      } else {
        if (this.optional) {
          return val
        } else {
          throw new ApiError(`No value provided and '${this.name}' is not optional`)
        }
      }
    }
  }
}

class Int16Type extends RangedNumberType {
  constructor (config) {
    super(Object.assign({type: 'int16'}, config), -65535, 65535)
  }

  _convertToType (val) {
    return parseInt(val)
  }
}
class ObjectType extends Type {
  constructor (config) {
    super(Object.assign({type: 'object'}, config))

    const types = config.types

    if (!Type.isValueDefined(types)) {
      this._types = null
      this._childRequiredKeys = []
    } else {
      if (!Array.isArray(types)) {
        throw new ApiError('types definition must be an Array of types')
      }

      const childRequiredKeys = []
      types.forEach(type => {
        if (!(type instanceof Type)) {
          throw new ApiError(`type specified as ${JSON.stringify(type)} is not an instance of Type class`)
        }

        if (!type.optional) {
          childRequiredKeys.push(type.name)
        }
      })

      this._types = types
      this._childRequiredKeys = childRequiredKeys
    }
  }

  get types () {
    return this._types
  }

  get childRequiredKeys () {
    return this._childRequiredKeys
  }

  _convertToType (val) {
    const result = this._getObject(val)
    this._validateRequiredKeys(result)

    if (Object.keys(result).length === 0) {
      if (this.optional) {
        return null
      } else {
        throw new ApiError(`Empty object created from data provided, but the object is not optional`)
      }
    }

    return result
  }

  _getObject (val) {
    // We have a free form object type
    if (!this.types) {
      return Object.assign({}, val)
    }

    const result = {}
    // Build the object based off the definitions for the keys
    this.types.forEach(typeAttribute => {
      const name = typeAttribute.name
      const typeValue = typeAttribute.getValue(val[name])

      if (Type.isValueDefined(typeValue)) {
        result[name] = typeValue
      }
    })
    return result
  }

  _validateRequiredKeys (result) {
    if (this.childRequiredKeys.length > 0) {
      const valueKeys = Object.keys(result)

      this.childRequiredKeys.forEach(requiredKey => {
        if (valueKeys.indexOf(requiredKey) === -1) {
          throw new ApiError(`Required key '${requiredKey}' is missing from the object`)
        }
      })
    }
  }
}

module.exports = {
  boolean: function (config) {
    return new BooleanType(config)
  },
  string: function (config) {
    return new StringType(config)
  },
  object: function (config) {
    return new ObjectType(config)
  },
  uint8: function (config) {
    return new UInt8Type(config)
  },
  int8: function (config) {
    return new Int8Type(config)
  },
  uint16: function (config) {
    return new UInt16Type(config)
  },
  int16: function (config) {
    return new Int16Type(config)
  },
  float: function (config) {
    return new FloatType(config)
  },
  list: function (config) {
    return new ListType(config)
  },
  choice: function (config) {
    return new ChoiceType(config)
  }
}
