var path = require('path')
var PiTempPlatform = require(path.join(__dirname, '/PiTempPlatform'))

module.exports = function(server, name, logger, instance) {
    this.name = name
    this.instance = instance
    this.initialized = false
    this.platform = new PiTempPlatform(this, name, server, logger, instance)
    this.platform.init()

    this.handleConfigurationRequest = function(dispatchedRequest) {
        this.platform.handleConfigurationRequest(dispatchedRequest)
    }
}