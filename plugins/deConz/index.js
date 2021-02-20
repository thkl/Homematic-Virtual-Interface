var path = require('path')

var DeConzPlatform = require(path.join(__dirname, '/DeConzPlatform'))

module.exports = function (server, name, logger, instance) {
  let self = this
  this.name = name
  this.instance = instance
  this.initialized = false
  this.platform = new DeConzPlatform(this, name, server, logger, instance)
  this.platform.init()
  this.handleApiRequest = (request, response) => {
    self.platform.handleApiRequest(self.platform, request, response)
  }
}
