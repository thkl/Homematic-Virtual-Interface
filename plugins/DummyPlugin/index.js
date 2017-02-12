var path = require('path')
var DummyPlatform = require(path.join(__dirname, '/DummyPlatform'))

module.exports = function (server, name, logger, instance) {
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new DummyPlatform(this, name, server, logger, instance)
  this.platform.init()

  this.handleConfigurationRequest = function (dispatchedRequest) {
    this.platform.handleConfigurationRequest(dispatchedRequest)
  }
}

