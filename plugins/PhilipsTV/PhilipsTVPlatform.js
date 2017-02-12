//
//  PhilipsTVPlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.01.2017
//  Copyright � 2017 kSquare.de. All rights reserved.
//

'use strict'

var request = require('request')
var color = require('onecolor')

var HomematicDevice

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }
if (appRoot.endsWith('node_modules/daemonize2/lib')) { appRoot = appRoot + '/../../../lib' }

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
var util = require('util')

function PhilipsTVPlatform (plugin, name, server, log, instance) {
  PhilipsTVPlatform.super_.apply(this, arguments)
  this.configuration = this.server.configuration
  this.lampData = {}
  this.layers = 0
  this.leftPixels = 0
  this.topPixels = 0
  this.rightPixels = 0
  this.bottomPixels = 0
  this.curPix = 0
  this.bridge = this.server.getBridge()
  HomematicDevice = this.server.homematicDevice
}

util.inherits(PhilipsTVPlatform, HomematicVirtualPlatform)

PhilipsTVPlatform.prototype.init = function () {
  this.log.info('Init %s', this.name)
  this.tv_ip = this.configuration.getValueForPlugin(this.name, 'tv_ip')
  var that = this

  var apiId = this.configuration.getPersistValueForPlugin(this.name, 'api_id')
  if (apiId) {
    this.apiId = apiId
    this.log.debug('using cached Philips API Version %s', that.apiId)
    this.getTopology()
  } else {
    request('http://' + this.tv_ip + ':1925/system', function (error, response, body) {
      if (!error && response.statusCode === 200) {
  	try {
    	var system = JSON.parse(body)
    	if (system) {
      that.apiId = system['api_version']['Major']
      that.log.debug('Philips API Version is %s', that.apiId)
      that.configuration.setPersistValueForPlugin(that.name, 'api_id', that.apiId)
      that.getTopology()
    }
  } catch (e) {}
  	} else {
	  	that.log.error('TV Init failed %s', error)
  	}
    })
  }

	// Generate HM Actor

  this.hmDevice = new HomematicDevice(this.name)
  this.hmDevice.initWithType('HM-LC-RGBW-WM', 'PhilipsTV')
  this.bridge.addDevice(this.hmDevice)

  this.hmDevice.on('device_channel_value_change', function (parameter) {
    var newValue = parameter.newValue
    var channel = that.hmDevice.getChannel(parameter.channel)

	    if (parameter.name === 'LEVEL') {
		    channel.startUpdating('LEVEL')
      channel.updateValue('LEVEL', newValue)

      if (newValue === 0) {
        that.curPix = 0
        that.loadCurrentLampData(function () {
          that.switchOff(10, function () {
            channel.endUpdating('LEVEL')
          		})
        })
      } else {
        that.setColor()
        that.switchMode('manual', function () {
          that.sendLampData(function () {
            channel.endUpdating('LEVEL')
          })
        })
      }
    }

    if (parameter.name === 'OLD_LEVEL') {
		   if (newValue === true) {
			   channel.startUpdating('LEVEL')
			   channel.updateValue('LEVEL', 1)
			   that.setColor()

			   that.switchMode('manual', function () {
			   		that.sendLampData(function () {
			   			channel.endUpdating('LEVEL')
     				})
   				})
		   }
    }

    if (parameter.name === 'PROGRAM') {
    	channel.startUpdating('PROGRAM')
      channel.updateValue('PROGRAM', newValue)

      if (newValue === 6) {
			    that.switchMode('internal', function () {

			    })
      }

      if (newValue === 1) {
			    that.switchMode('lounge', function () {

			    })
		    }

		    if (newValue === 0) {
			    that.curPix = 0
      that.loadCurrentLampData(function () {
        that.switchOff(10, function () {
        })
      })
		    }

      channel.endUpdating('PROGRAM')
    }

    if (parameter.name === 'COLOR') {
      channel.startUpdating('COLOR')
      channel.updateValue('COLOR', newValue)

      that.setColor()

      that.switchMode('manual', function () {
        that.sendLampData(function () {
          channel.endUpdating('COLOR')
        })
      })
    }
  })
}

PhilipsTVPlatform.prototype.setColor = function () {
  var that = this
  var coChannel = this.hmDevice.getChannelWithTypeAndIndex('RGBW_COLOR', '2')
  var diChannel = this.hmDevice.getChannelWithTypeAndIndex('DIMMER', '1')

  var col = coChannel.getValue('COLOR')
  var bri = diChannel.getValue('LEVEL')

  this.loadCurrentLampData(function () {
    var myColor = new color.HSV((col / 199), 1, bri)
    var myRGB = myColor.rgb()
    that.log.debug(JSON.stringify(myColor))
    that.log.debug(JSON.stringify(myRGB))
    for (var i = 0; i <= that.pixels; i++) {
      that.switchPixelToColor(1, i, Math.ceil(myRGB.red() * 255), Math.ceil(myRGB.green() * 255), Math.ceil(myRGB.blue() * 255))
    }
  })
}

PhilipsTVPlatform.prototype.getTopology = function () {
  this.log.debug('loading topology')
  var that = this
  var topo = this.configuration.getPersistValueForPlugin(this.name, 'topology')
  if (topo) {
    var topology = JSON.parse(topo)
    this.log.debug('used cached topology')
    this.parseTopology(topology)
    return
  } else {
	 	request('http://' + this.tv_ip + ':1925/' + this.apiId + '/ambilight/topology', function (error, response, body) {
	 	if (!error && response.statusCode === 200) {
   try {
     var topology = JSON.parse(body)
     if (topology) {
       that.configuration.setPersistValueForPlugin(that.name, 'topology', JSON.stringify(topology))
       that.parseTopology(topology)
     } else {
       that.log.error('Topology not readable')
     }
   } catch (e) { that.log.error(e) }
  		} else {
	  		that.log.error('TV Ambilight Topology request failed %s', error)
  		}
 })
  }
}

PhilipsTVPlatform.prototype.parseTopology = function (topology) {
  this.layers = topology.layers
  this.leftPixels = topology.left
  this.topPixels = topology.top
  this.rightPixels = topology.right
  this.bottomPixels = topology.bottom
  this.pixels = (this.leftPixels + this.topPixels + this.rightPixels + this.bottomPixels)
  this.log.debug('Topology loaded %s pixels.', this.pixels)
}

PhilipsTVPlatform.prototype.switchOff = function (delay, callback) {
  var that = this
  if (this.curPix > this.pixels) {
    callback()
    return
  }
  this.switchPixelToColor(1, this.curPix, 0, 0, 0)
  this.curPix = this.curPix + 1

  that.switchMode('manual', function () {
    that.sendLampData(function () {
      setTimeout(function () {
        that.switchOff(delay, callback)
      }, delay)
    })
  })
}

PhilipsTVPlatform.prototype.loadCurrentLampData = function (callback) {
  var that = this
  request('http://' + this.tv_ip + ':1925/' + this.apiId + '/ambilight/processed', function (error, response, body) {
    if (!error && response.statusCode === 200) {
      try {
        that.lampData = JSON.parse(body)
        callback()
      } catch (e) { that.log.error(e) }
    }
  })
}

PhilipsTVPlatform.prototype.sendLampData = function (callback) {
  this.log.debug(JSON.stringify(this.lampData))
  this.sendCommand('ambilight/cached', JSON.stringify(this.lampData), function (error, response) {
    if (error) {
      this.log.error(error)
    }
    callback()
  })
}

PhilipsTVPlatform.prototype.switchMode = function (newMode, callback) {
  var that = this

  var modeRequest = '{"current":"' + newMode + '"}'
  this.sendCommand('ambilight/mode', modeRequest, function (error, response) {
    if (error) {
	    that.console(error)
    }
    callback()
  })
}

PhilipsTVPlatform.prototype.switchPixelToColor = function (layer, pixelId, red, green, blue) {
  if (this.pixels > 0) {
    if (pixelId <= this.pixels) {
      var side = 'left'
      var pixel = pixelId

      if (pixelId > this.leftPixels) {
        side = 'top'
        pixel = pixelId - (this.leftPixels) - 1
      }

      if (pixelId > (this.leftPixels + this.topPixels)) {
        side = 'right'
        pixel = pixelId - (this.leftPixels + this.topPixels) - 1
      }

      if (pixelId > (this.leftPixels + this.topPixels + this.rightPixels)) {
        side = 'bottom'
        pixel = pixelId - (this.leftPixels + this.topPixels + this.rightPixels) - 1
      }

      try {
        this.lampData['layer' + layer][side][pixel]['r'] = red
        this.lampData['layer' + layer][side][pixel]['g'] = green
        this.lampData['layer' + layer][side][pixel]['b'] = blue
      } catch (e) {
        this.log.error(e)
      }
    }
  }
}

PhilipsTVPlatform.prototype.sendCommand = function (path, data, callback) {
  var url = 'http://' + this.tv_ip + ':1925/' + this.apiId + '/' + path
  var that = this
  request(
    { method: 'POST',
      uri: url,
      body: data

    },

function (error, response, body) {
  if (error) {
    that.log.error('HTTP ', error)
  } else {
    that.log.debug('HTTP Response %s', body)
  }
  callback(error, body)
}
  )
}

PhilipsTVPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  dispatchedRequest.dispatchFile(this.plugin.pluginPath, 'index.html', undefined)
}

module.exports = PhilipsTVPlatform

