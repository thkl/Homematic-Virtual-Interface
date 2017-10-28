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

function DummyPlatform (plugin, name, server, log, instance) {
  DummyPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(DummyPlatform, HomematicVirtualPlatform)

DummyPlatform.prototype.init = function () {
 
  var that = this

  // your need a device file which is not bundled in core system. copy data like this 
  // as an example the HM-Sen-Wa-Od.json should be located in your plugin root
  
  /* 
   var devfile = path.join(__dirname,'HM-Sen-Wa-Od.json');
   var buffer = fs.readFileSync(devfile);
   var devdata = JSON.parse(buffer.toString());
   this.server.transferHMDevice('HM-Sen-Wa-Od',devdata);
  */
  var serial = 'Dum_1234'
  
  // this is new Call since Core Version 0.2.58
  // bridge.initDevice(pluginName,serialNum,Type)
  // if the device was initialized before stored data will be used. If not, the core system builds up a new device
  this.hmDevice = this.bridge.initDevice(this.getName(),serial,"HM-LC-RGBW-WM")  

  // the old implementation : 
  /**
  // create a Device like this :
  this.hmDevice = new HomematicDevice(this.getName())
  // first check if you have a persistent data file for your device serial
  var data = this.bridge.deviceDataWithSerial(serial)
  if (data!=undefined) {
  // if there is a persistent file with data create the device from that data
	this.hmDevice.initWithStoredData(data)
  }
  
  if (this.hmDevice.initialized === false) {
	  // if not build a new device from template
	  this.hmDevice.initWithType("HM-LC-RGBW-WM",serial)
	  this.hmDevice.serialNumber = serial
	  this.bridge.addDevice(this.hmDevice,true)
  } else {
      // device was initalized from persistent data just add it to the interface
	  this.bridge.addDevice(this.hmDevice,false)
  }
  */
  
  
  // this will trigered when a value of a channel was changed by the ccu
  this.hmDevice.on('device_channel_value_change', function (parameter) {
    var newValue = parameter.newValue
    var channel = that.hmDevice.getChannel(parameter.channel)

    // sample do something when parameter with name level was changed
    if (parameter.name === 'LEVEL') {
		// new level is in "newValue"
        console.log('Channel %s update with %s', channel, newValue)
        // place your own logic here to send this value to your physical device ....
        
        ....
        
        
        //
    }
  })

  // if you want to periodical check the state of your physical device you may use something like that
  
  setTimeout(function (){
	  // check value
	that.loadValues()	  
  }, 6000)
  

  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}

// ask your physical device for state etc ...

DummyPlatform.prototype.loadValues = function (dispatchedRequest) {
	let that = this
	// demo only so it will compile
	let value = 1;
	// insert real query here
	
    //	let value = myPhysicalDevice.getData()
	
	
	// change the virtual homematic device data
	// first get the channel - in this example the dimmer channel with number 1
	let channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1")
	if (channel) {
		  // Channel was found .. update the value paramset for parameter LEVEL and send it to the ccu (,true,true)
		  channel.updateValue("LEVEL",value,true,true);
	}
	
// do it again i about 6 seconds	 
  setTimeout(function (){
	  // check value
	that.loadValues()	  
  }, 6000)

}

DummyPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

module.exports = DummyPlatform
