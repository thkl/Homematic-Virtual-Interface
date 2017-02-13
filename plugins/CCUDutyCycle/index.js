var path = require('path')
var CCUDutyCycle = require(path.join(__dirname, '/CCUDutyCycle'))

module.exports = function (server, name, logger, instance) {
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new CCUDutyCycle(this, name, server, logger, instance)
  this.platform.init()

  this.handleConfigurationRequest = function (dispatchedRequest) {
    this.platform.handleConfigurationRequest(dispatchedRequest)
  }
}

