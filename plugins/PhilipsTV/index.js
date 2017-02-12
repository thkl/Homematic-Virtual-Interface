var path = require('path')
var PhilipsTVPlatform = require(path.join(__dirname, '/PhilipsTVPlatform.js'))

module.exports = function (server, name, logger, instance) {
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new PhilipsTVPlatform(this, name, server, logger, instance)
  this.platform.init()

  this.handleConfigurationRequest = function (dispatchedRequest) {
    this.platform.handleConfigurationRequest(dispatchedRequest)
  }
}

