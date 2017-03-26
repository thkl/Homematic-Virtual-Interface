var path = require('path')
var NanoleafAuroraPlatform = require(path.join(__dirname, '/NanoleafAuroraPlatform'))

module.exports = function (server, name, logger, instance) {
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new NanoleafAuroraPlatform(this, name, server, logger, instance)
  this.platform.init()

  this.handleConfigurationRequest = function (dispatchedRequest) {
    this.platform.handleConfigurationRequest(dispatchedRequest)
  }
}

