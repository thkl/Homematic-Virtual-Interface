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
const dorita980 = require('dorita980')

function CleanOMat980Platform (plugin, name, server, log, instance) {
  CleanOMat980Platform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(CleanOMat980Platform, HomematicVirtualPlatform)

CleanOMat980Platform.prototype.init = function () {
 
  var that = this

  this.configuration = this.server.configuration;

  var devfile = path.join(__dirname,'HM-RC-Key4_Clean.json');
  var buffer = fs.readFileSync(devfile);
  var devdata = JSON.parse(buffer.toString());
  this.server.transferHMDevice('HM-RC-Key4-2Clean',devdata);
  
  var serial = 'Cleo980'
  this.hmDevice = new HomematicDevice(this.getName())
  var data = this.bridge.deviceDataWithSerial(serial)
  if (data!=undefined) {
	this.hmDevice.initWithStoredData(data)
  }
  
  if (this.hmDevice.initialized === false) {
	  this.hmDevice.initWithType('HM-RC-Key4-2Clean',serial)
	  this.hmDevice.serialNumber = serial
	  this.bridge.addDevice(this.hmDevice,true)
  } else {
	  this.bridge.addDevice(this.hmDevice,false)
  }

  
  this.hmDevice.on('device_channel_value_change', function (parameter) {
    var newValue = parameter.newValue
    var channel = that.hmDevice.getChannel(parameter.channel)
		if (parameter.name === 'PRESS_SHORT') {
			let cred = that.credentials()
			if (cred != undefined) {
			
			switch (channel.index) {
				case '1':
				  // Start
				  that.log.info('Sending Start')
				  that.command('start')
				  break;
				case '2':
				  // Stop
				  that.log.info('Sending Stop')
				  that.command('stop')
				  break;
				case '3':
				  // Dock      
				  that.log.info('Sending Dock')
				  that.command('dock')
				  break;
			}
		  } else {
			that.log.error('there was no robot configurated')
		  }
		}
  })

  // if you want to periodical check the state of your physical device you may use something like that
  
  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
  this.command('update')
}

CleanOMat980Platform.prototype.command = function (command) {
  // send command to the robot
  var that = this
  let cred = this.credentials()
  if (cred != undefined) {
	this.myRobotViaLocal = new dorita980.Local(cred.blid, cred.pwd, cred.ip); // robot IP address
	
	this.myRobotViaLocal.on('connect', function () {
		that.log.debug('connected to robot')
		switch (command) {
			case 'start':
				
				setTimeout(function(){
				that.log.debug('start command')
			 	that.myRobotViaLocal.start().then(() => {
					that.log.debug('end connection')
			 		that.myRobotViaLocal.end(); 
  				}).catch((err) => {
  					that.log.error(err);
  				});
					
				}, 500);
				
			break;
			case 'stop' :
				setTimeout(function(){
				that.log.debug('stop command')
			 	that.myRobotViaLocal.stop().then(() => {
					that.log.debug('end connection')
			 		that.myRobotViaLocal.end(); 
  				}).catch((err) => {
  					that.log.error(err);
  				});
				}, 500);
			break;
			case 'dock' :
				setTimeout(function(){
				that.log.debug('dock command')
			 	that.myRobotViaLocal.dock().then(() => {
					that.log.debug('end connection')
			 		that.myRobotViaLocal.end(); 
  				}).catch((err) => {
  					that.log.error(err);
  				});
				}, 500);
			break;
			case 'update' :
				setTimeout(function(){
				that.log.debug('update command')
				
				that.myRobotViaLocal.getRobotState(['batPct', 'bin','cleanMissionStatus']).then((actualState) => {
					that.log.debug('end connection')
					that.myRobotViaLocal.end()
					if ((actualState.batPct) && (actualState.bin) && (actualState.cleanMissionStatus)) {
						var di_channel = that.hmDevice.getChannelWithTypeAndIndex('KEY','4')
						di_channel.updateValue('CUR_STATE',actualState.cleanMissionStatus.phase,true);
						di_channel.updateValue('BATTERIE',actualState.batPct,true);
						di_channel.updateValue('BIN',actualState.bin.full,true);
					}
					clearTimeout(that.timer)
					that.timer = setTimeout(function() {
						that.command('update')
					}, (that.refreshTime * 60000))
					
		   		});
		   		
				}, 500);
			break;
			default:
				that.myRobotViaLocal.end()
				that.log.debug('end connection thru default')
		}
	
	});
	
	this.myRobotViaLocal.on('offline', function () {
		that.log.debug('Robot went offline next update in %s min',that.refreshTime)
		clearTimeout(that.timer)
			that.timer = setTimeout(function() {
			that.command('update')
		}, (that.refreshTime * 60000))
	})
	
	
  } else {
	  this.log.error('Please setup your robot credentials')
  }
}

CleanOMat980Platform.prototype.credentials = function() {
  let blid = this.configuration.getValueForPluginWithDefault(this.name,'blid',undefined);
  let password = this.configuration.getValueForPluginWithDefault(this.name,'password',undefined);
  let robotip = this.configuration.getValueForPluginWithDefault(this.name,'robotip',undefined);
  this.refreshTime = this.configuration.getValueForPluginWithDefault(this.name,'refresh',2);
  if ((blid != undefined) && (password != undefined) && (robotip != undefined)) {
	  return {'blid':blid,'pwd':password,'ip':robotip}
  } else {
	  return undefined;
  }
}

CleanOMat980Platform.prototype.showSettings = function(dispatched_request) {
	let blid = this.configuration.getValueForPluginWithDefault(this.name,'blid','')
	let password = this.configuration.getValueForPluginWithDefault(this.name,'password','')
	let robotip = this.configuration.getValueForPluginWithDefault(this.name,'robotip','')
	let refresh = this.configuration.getValueForPluginWithDefault(this.name,'refresh',2)

  	var desc = 'you may get the blib by executing the following tool:<br /> node ' +  __dirname + '/node_modules/dorita980/bin/getpassword.js IPOfYourRobot';
  	
  	var result = []
  	
	result.push({'control':'text','name':'blid','label':'Blid','value':blid, 'description': desc})
	result.push({'control':'text','name':'password','label':'Password','value':password})
	result.push({'control':'text','name':'robotip','label':'Robot IP','value':robotip})
	result.push({'control':'text','name':'refresh','label':'Refresh','value':refresh})
	return result;
}

CleanOMat980Platform.prototype.saveSettings = function(settings) {
	let that = this
	let blid = settings.blid;
	let password = settings.password;
	let robotip = settings.robotip;
	let refresh = settings.refresh;
	if ((password) && (password) && (robotip)) {
		this.configuration.setValueForPlugin(this.name,'blid',blid)
		this.configuration.setValueForPlugin(this.name,'password',password)
		this.configuration.setValueForPlugin(this.name,'robotip',robotip)
		if (refresh < 1) {refresh = 1}
		this.configuration.setValueForPlugin(this.name,'refresh',1)
		this.command('update')
	}
}

CleanOMat980Platform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
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

module.exports = CleanOMat980Platform
