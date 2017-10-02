// adapted flowerpower access from https://github.com/hobbyquaker/flowerpower2mqtt 


'use strict'

const fs = require('fs')
const path = require('path')

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
var async = require('async')
var FlowerPower = require('flower-power')

function FlowerPowerPlatform (plugin, name, server, log, instance) {
  FlowerPowerPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
  this.flSticks = {};
  this.devices = {};
}

util.inherits(FlowerPowerPlatform, HomematicVirtualPlatform)

FlowerPowerPlatform.prototype.init = function () {
  var that = this

  var devfile = path.join(__dirname,'HM-WDS40-TH-I-2_FP.json');
  var buffer = fs.readFileSync(devfile);
  var devdata = JSON.parse(buffer.toString());
  this.server.transferHMDevice('HM-WDS40-TH-I-2_FP',devdata);
 
  this.discover(function(){
	  that.plugin.initialized = true
	  that.log.info('initialization completed %s', that.plugin.initialized)
	  that.pollAll()
	  setInterval(function () {
		  that.pollAll()
	  },  3600 * 1000);
  });

}

FlowerPowerPlatform.prototype.pollAll = function() {

 var jobs = []
 var that = this
 
 for (var id in that.flSticks) {
     that.log.info('Adding %s to polling queue' , id)
     jobs.push(function (job_callback) {
	     that.pollData(id, function(){
		      job_callback()
		 }) 
     })
 }
 
 async.series(jobs)
   	  
}



FlowerPowerPlatform.prototype.discover = function(callback) {
	
	this.log.info('FlowerPower.discoverAll')
	var that = this
	var discoverCallback = callback
	var handler = function (flowerPower) {
		
		that.log.info('< discoverAll %s - %s', flowerPower.address, flowerPower.name);
		 
		
		let num =  flowerPower.address.substr(12,5).replace(':', '').toUpperCase()
		
		that.log.info('Initialize FlowerPower Device with id FLPW%s',num)
		var device = new HomematicDevice(that.getName())
		var data = that.bridge.deviceDataWithSerial(flowerPower.address)
		if (data!=undefined) {
			device.initWithStoredData(data)
		}

		if (device.initialized === false) {
			device.initWithType("HM-WDS40-TH-I-2_FP","FLPW" + num)
			device.serialNumber = flowerPower.address
			that.bridge.addDevice(device,true)
		} else {
			that.bridge.addDevice(device,false)
		}
		
		device.on('device_channel_install_test', function(parameter){
			that.ledFlash(flowerPower.id)
			var channel = device.getChannel(parameter.channel)
			channel.endUpdating("INSTALL_TEST")
		});
		
		
		that.devices[flowerPower.id] = device
		that.flSticks[flowerPower.id] = flowerPower
		
		flowerPower.on('disconnect', function() {
            that.log.info('disconnected %s',flowerPower.id)
        })

        flowerPower.on('sunlightChange', function (sunlight) {
            that.log.info('%s < sunlightChange %s', flowerPower.id, sunlight)
        })

        flowerPower.on('soilElectricalConductivityChange', function (soilElectricalConductivity) {
            that.log.info('%s < soilElectricalConductivityChange %s', flowerPower.id, soilElectricalConductivity)
        })

        flowerPower.on('soilTemperatureChange', function (temperature) {
            that.log.info('%s < soilTemperatureChange %s', flowerPower.id,  temperature)
        })

        flowerPower.on('airTemperatureChange', function (temperature) {
            that.log.info('%s < airTemperatureChange %s',flowerPower.id,  temperature)
        })

        flowerPower.on('soilMoistureChange', function (soilMoisture) {
            that.log.info('%s < soilMoistureChange %s', flowerPower.id,  soilMoisture)
        })

    }
	
	FlowerPower.discoverAll(handler)
	
	setTimeout(function () {
        that.log.info('FlowerPower.stopDiscoverAll')
        FlowerPower.stopDiscoverAll(handler)
        discoverCallback()
    }, 30000)
}

FlowerPowerPlatform.prototype.pollData = function (lwId,poll_callback) {
	
	let flowerPower = this.flSticks[lwId]
	let hmDevice = this.devices[lwId]
	let that = this
    var tout
    
	async.series([
        
        function (callback) {
            that.log.info(' try connectAndSetup %s',flowerPower.id)
            flowerPower.connectAndSetup(function (err) {
                that.log.info('connectAndSetup done %s',flowerPower.id)
                if (err) that.log.error(flowerPower.id, err)
                callback(err)
            });
        },
        
        function (callback) {
            that.log.info('> readBatteryLevel %s',flowerPower.id)
            flowerPower.readBatteryLevel(function (err, batteryLevel) {
                if (!err) {
	               let channel = hmDevice.getChannelWithTypeAndIndex("MAINTENANCE","0")
	               if (channel) {
				   	   that.log.info('%s < readBatteryLevel %s - Update Channel', flowerPower.id, batteryLevel)
		               channel.updateValue("LOWBAT",(batteryLevel<20),true,true);
	               } else {
		               that.log.error('Channel MAINTENANCE not found')
	               }
                }else {
	                that.log.error('%s < readBatteryLevel %s',flowerPower.id,err)
                }
                callback()
            });
        },
        
        function (callback) {
            that.log.info('> readSunlight %s',flowerPower.id)
            flowerPower.readSunlight(function (err, sunlight) {
                 if (!err) {
	               let channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1")
				   if (channel) {
					   let sun = Math.round(parseFloat(sunlight) * 100)
					   channel.updateValue("BRIGHTNESS",sun,true,true)
					   that.log.info('%s < readSunlight %s - Update Channel',flowerPower.id,sunlight)
				   }else {
		               that.log.error('Channel WEATHER not found')
	               }
				}else {
	                that.log.error('%s < readSunlight %s',flowerPower.id,err)
                }
                callback()
            });
        },
        function (callback) {
            that.log.info('> readSoilElectricalConductivity %s',flowerPower.id)
            flowerPower.readSoilElectricalConductivity(function (err, soilElectricalConductivity) {
                if (!err) {
	               let channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1")
				   if (channel) {
					   let fert = parseFloat(soilElectricalConductivity / 1770) * 10
					   channel.updateValue("FERTILISER",fert,true,true);
					   that.log.info('%s < readSoilElectricalConductivity %s -  Update Channel',flowerPower.id, soilElectricalConductivity)
					}	 else {
		               that.log.error('Channel WEATHER not found')
	               }               
                }else {
	                that.log.error('%s < readSoilElectricalConductivity %s',flowerPower.id,err)
                }
				callback();
            });
        },
        
        function (callback) {
            that.log.info('> readSoilTemperature %s',flowerPower.id);
            flowerPower.readSoilTemperature(function (err, temperature) {
                that.log.debug(' %s < readSoilTemperature',flowerPower.id, temperature);
                if (!err) {
	               let channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1")
				   if (channel) {

					}	 else {
		               that.log.error('Channel WEATHER not found')
	               }               
                }else {
	                that.log.error('%s < readSoilTemperature %s',flowerPower.id,err)
                }
                callback()
            });
        },
        function (callback) {
            that.log.info(flowerPower.id, '> readAirTemperature %s',flowerPower.id)
            flowerPower.readAirTemperature(function (err, temperature) {
                if (!err) {
	                let channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1")
				   if (channel) {
					   channel.updateValue("TEMPERATURE",temperature,true,true);
					   that.log.info('%s < readAirTemperature -  Update Channel',flowerPower.id, temperature)
					}	 else {
		               that.log.error('Channel WEATHER not found')
	               }               
                }else {
	                that.log.error('%s < readAirTemperature %s',flowerPower.id,err)
                }
                callback()
            });
        },
        function (callback) {
            that.log.info('> readSoilMoisture %s',flowerPower.id)
            flowerPower.readSoilMoisture(function (err, soilMoisture) {
                if (!err) {
	               let channel = hmDevice.getChannelWithTypeAndIndex("WEATHER","1")
				   if (channel) {
					   let mst = Math.round(parseFloat(soilMoisture) * 100) / 100
					   channel.updateValue("SOILMOISTURE",mst,true,true);
					   that.log.info('%s < readSoilMoisture %s - Update Channel',flowerPower.id,soilMoisture)
					}	                
                } else {
	                that.log.error('%s < readSoilMoisture %s',flowerPower.id,err)
                }
                callback()
            });
        },
        
        function (callback){
            that.log.info('> disconnect %s',flowerPower.id)
            clearTimeout(tout)
            flowerPower.disconnect(callback)
            if (typeof poll_callback === 'function') {
	            poll_callback()
	        }
        },
		
		        
    ])

    tout = setInterval(function () {
	    that.log.warn('Polling Timeout')
		 if (typeof poll_callback === 'function') {
	            poll_callback()
	     }
	},10000)
}


FlowerPowerPlatform.prototype.ledFlash = function (lwId) {
    let flowerPower = this.flSticks[lwId]
    let that = this
    var cmds = [
        function (callback) {
	        that.log.debug('> connect %s',flowerPower.id)
            flowerPower.connectAndSetup(function (err) {
                callback(err)
            })
        },
        function (callback) {
	        that.log.debug('> pulse %s',flowerPower.id)
            flowerPower.ledPulse(function (err) {
                setTimeout(callback, 10000)
            })
        },
        function (callback) {
	        that.log.debug('> ledOff %s',flowerPower.id)
            flowerPower.ledOff(function (err) {
                callback()
            })
        },
        function (callback) {
	        that.log.debug('> disconnect %s',flowerPower.id)
            flowerPower.disconnect(callback)
        }
    ]
    async.series(cmds);
}



FlowerPowerPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

module.exports = FlowerPowerPlatform
