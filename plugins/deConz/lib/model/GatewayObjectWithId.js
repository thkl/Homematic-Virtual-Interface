const path = require('path')
const GatewayObject = require(path.join(__dirname, 'GatewayObject.js'))

module.exports = class GatewayObjectWithId extends GatewayObject {
  constructor (attributes, id) {
    super(attributes)
    this.setAttributeValue('id', id)
  }

  get id () {
    return this.getAttributeValue('id')
  }
}
