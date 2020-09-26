'use strict'

const path = require('path')
const fs = require('fs')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

const HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
const Gateway = require(path.join(__dirname , 'lib', 'Gateway.js'))

const util = require('util')
const url = require('url')
var HomematicDevice


class DeConzPlatform extends HomematicVirtualPlatform {

  constructor(plugin, name, server, log, instance) {
    super(plugin, name, server, log, instance)
    HomematicDevice = server.homematicDevice
  }


 init () {

    this.configuration = this.server.configuration
    this.connect()
    this.plugin.initialized = true
    this.log.info('initialization completed %s', this.plugin.initialized)
}

async connect() {
  if (this.gateway) {
    this.gateway.shutdown()
  }

  let self = this
  let host = this.configuration.getValueForPlugin(this.name, 'host', undefined)
    let key = this.configuration.getValueForPlugin(this.name, 'key', undefined)
    if ((host !== undefined) && (key !== undefined)) {
      this.hmDevices = []
      this.gateway = new Gateway(host, 80, this.log)
      this.gateway.setApikey(key)
        await this.gateway.connect()

        this.gateway.getSensors().map((sensor) => {
 
          switch (sensor.type) {
          case 'ZHASwitch':
            self.log.debug('New ZHASwitch with serial %s',sensor.uniqueid)
            const ZHASwitch = require(path.join(__dirname , 'ZHASwitch.js'))
            let d = new ZHASwitch(self,sensor)
            self.hmDevices.push(d.hmDevice)
          break    

          case 'ZHAPresence':
            self.log.debug('New ZHAPresence with serial %s',sensor.uniqueid)
            const ZHAPresence = require(path.join(__dirname , 'ZHAPresence.js'))
            let s = new ZHAPresence(self,sensor)
            self.hmDevices.push(s.hmDevice)
          break
        }
      })
    }
}


showSettings (dispatched_request) {
  let host = this.configuration.getValueForPlugin(this.name, 'host', '')
  let key = this.configuration.getValueForPlugin(this.name, 'key', '')

  var result = []
  result.push({ 'control': 'text', 'name': 'host', 'label': 'Phoscon Gateway Host', 'value': host })
  result.push({ 'control': 'text', 'name': 'key', 'label': 'Phoscon API Key', 'value': key })
  return result
}

saveSettings (settings) {
  let host = settings.host
  let key = settings.key
  if ((host) && (key)) {
    this.configuration.setValueForPlugin(this.name, 'host', host)
    this.configuration.setValueForPlugin(this.name, 'key', key)
    this.connect()
  }
}

handleConfigurationRequest (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''

  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  } else {
    var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
    this.hmDevices.map(hmdevice=>{
      deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{"device_id":hmdevice.serialNumber});
    })
  }

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}


shutdown () {
  this.log.info("Shutdown")
  this.gateway.shutdown()
}
}
module.exports = DeConzPlatform
