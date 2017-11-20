var path = require('path')
var DashButtonPlatform = require(path.join(__dirname, '/DashButtonPlatform'))

module.exports = function (server, name, logger, instance) {
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new DashButtonPlatform(this, name, server, logger, instance)
  this.platform.init()

  this.handleConfigurationRequest = function (dispatchedRequest) {
    this.platform.handleConfigurationRequest(dispatchedRequest)
  }
}

