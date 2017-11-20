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

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var dash_button = require('node-dash-button');

function DashButtonPlatform (plugin, name, server, log, instance) {
  DashButtonPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(DashButtonPlatform, HomematicVirtualPlatform)

DashButtonPlatform.prototype.init = function () {
 
  var that = this
  this.hm_layer = this.server.getBridge();
  
  var devfile = path.join(__dirname,'HM-PB-2-FM.json');
  var buffer = fs.readFileSync(devfile);
  var devdata = JSON.parse(buffer.toString());
  this.server.transferHMDevice('HM-PB-2-FM',devdata);
  this.configuration = this.server.configuration
  this.reloadButtons()
  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}

DashButtonPlatform.prototype.reloadButtons = function () {
  var that = this
  this.hm_layer.deleteDevicesByOwner(this.name)
  this.buttons = []
  var macs = []
  var btns =  this.configuration.getValueForPlugin(this.name,'buttons')
  btns.some(function(button){
	
	macs.push(button.mac)
    var hmDevice = that.hm_layer.initDevice(that.getName(),'Dash_' + button.serial,'HM-PB-2-FM')
    hmDevice.buttonMac = button.mac
    that.buttons.push(hmDevice)		
		  
  })
 
  var dash = dash_button(macs, null, 5, 'all');
  
  dash.on('detected', function (dash_id){
    
    that.buttons.some(function(hmdevice){
	    
	    if (hmdevice.buttonMac === dash_id) {
		   var key_channel = hmdevice.getChannelWithTypeAndIndex('KEY','1')
		   key_channel.updateValue('PRESS_SHORT',1,true)
		   setTimeout(function(){
			   key_channel.updateValue('PRESS_SHORT',0,true)
		   }, 500)
	    }

    })
    
   })

}

DashButtonPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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
  }

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = DashButtonPlatform
