'use strict'

const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

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

const {TradfriClient, Accessory, AccessoryTypes} = require('node-tradfri-client')

var util = require('util')
var HomematicDevice
var url = require('url')
var TradfriDevice = require("./TradfriDevice.js").TradfriDevice;
var TradfriGroup = require("./TradfriGroup.js").TradfriGroup;

function TradfriPlatform (plugin, name, server, log, instance) {
	TradfriPlatform.super_.apply(this, arguments)
	HomematicDevice = server.homematicDevice
	this.trApiLightbulbs = {}
	this.trApiGroups = {}
	this.trApiScenes = {}
}

util.inherits(TradfriPlatform, HomematicVirtualPlatform)

TradfriPlatform.prototype.init = function () {

	var that = this

	// copy the needed device.json
	var devs = { 
		rgb: 'VIR-LG-RGB-DIM_Tradfri',
		white: 'VIR-LG-WHITE-DIM_Tradfri',
		dim: 'VIR-LG-DIM_Tradfri',
		group: 'VIR-LG-GROUP_Tradfri'
		}

	for (var dev in devs) {

		var devfile = path.join(__dirname, devs[dev] + '.json' )
		var buffer = fs.readFileSync(devfile)
		var devdata = JSON.parse(buffer.toString())
		this.server.transferHMDevice( devs[dev],devdata)

	}

	this.configuration = this.server.configuration
	this.tradfriUser = this.configuration.getValueForPlugin(this.name,'tradfri_user')
	this.securityCode = this.configuration.getValueForPlugin(this.name,'tradfri_securityCode')
	this.bridgeIp = this.configuration.getValueForPlugin(this.name,'tradfri_ip')

	this.heartBeatId = 'undefined'
	
	this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings");

	this.plugin.initialized = true
	
	this.log.info('initialization completed %s', this.plugin.initialized)

	if (this.bridgeIp!=undefined) {
		// give a bit time
		setTimeout(function(){that.reconnect()}, 3000)
	} else {
		this.log.warn('missing bridge ip')
	}
}

// establish Gateway Connection /////////////////////////////////////////////////
//
//
TradfriPlatform.prototype.reconnect = function() {
	
	var that = this

	// don't delete all the known devices on reconnect
	// this.trApiLightbulbs = {}
	// this.trApiGroups = {}
	// this.trApiScenes = {}

	if ((this.securityCode == undefined) && (this.securityID == undefined)) {
		this.log.warn('No credentials')
		return
	}

	if (this.tradfriUser == undefined) {
		this.securityCode = undefined
	}

	this.tradfri = new TradfriClient(that.bridgeIp);

	// Check if we have to authenticate
	if ((this.securityCode == undefined) || (this.tradfriUser == undefined)){
		
		this.log.warn('we have to authenticate first')
		
		this.tradfri.authenticate(this.securityID).then((identity, psk) => {
			// work with the result
			that.tradfriUser = identity
			that.securityCode = psk
			that.configuration.setValueForPlugin(that.name,"tradfri_securityCode",that.securityCode); 
			that.configuration.setValueForPlugin(that.name,"tradfri_user",that.tradfriUser); 
			that.configuration.setValueForPlugin(that.name,"tradfri_securityid",'removed'); 
			setTimeout(function(){that.reconnect()}, 1000)
		})
		
		.catch((e) => {
			that.log.error('Gateway authentication error %s',e)
		})

	} else {

		that.log.info('Try to connect to Tradfri Gateway')

		this.tradfri.reset()

		this.tradfri.connect(that.tradfriUser, that.securityCode).then((result) => {
			// start observing the devices, groups and scenes
			tradfri_observe()
		})
		.catch((e) => {
			// handle error
			that.log.error("Gateway connection error %s", e)
		})
	}
	
	// Start Observing /////////////////////////////////////////////////
	//
	//
	function tradfri_observe(result) {

		// new Connection established, stop old heartbeat interval if there is one
		if ( that.heartBeatId != 'undefined' ){
			clearInterval(that.heartBeatId)
			that.log.info('Heartbeat stoped')
		}

		that.log.info('connected to Gateway')
		that.tradfri
		.on("error", tradfri_error)
		.on("device updated", tradfri_deviceUpdated)
		.on("device removed", tradfri_deviceRemoved)
		.observeDevices()
		;
		that.tradfri
		.on("error", tradfri_error)
		.on("scene updated", tradfri_sceneUpdated)
		.on("scene removed", tradfri_sceneRemoved)
		.on("group updated", tradfri_groupUpdated)
		.on("group removed", tradfri_groupRemoved)
		.observeGroupsAndScenes()
		;
		that.tradfri.setMaxListeners(250)
		that.log.info('Observer added and increased maxListeners to 250')
		;

		// start hearbeat to monitor connection
		that.heartBeatId = setInterval(tradfri_health, 15000)
		that.log.info('Heartbeat started')
	}


	// Device updated callback //////////////////////////////////////////////////
	//
	//
	// A device was added or changed
	function tradfri_deviceUpdated(device) {

		if (device.type === AccessoryTypes.lightbulb) {
			
			// Create the Devices or update them
			if (!that.trApiLightbulbs[device.instanceId]) {

				// fill the node-tradfri-client lights api object
				that.trApiLightbulbs[device.instanceId] = device

				that.log.info('new Lamp %s found',device.instanceId)
				var tdevice = new TradfriDevice(that, device.instanceId)		// (plugin, id)
			} else {
				
				// update the node-tradfri-client lights api object
				that.trApiLightbulbs[device.instanceId] = device
				that.log.debug('update Lamp %s',device.instanceId)
			}
		} else if (device.type === AccessoryTypes.remote) {
			// fill and update the node-tradfri-client remote api object
			// remember it

		} else if (device.type === AccessoryTypes.motionSensor) {
			// fill and update the node-tradfri-client motionsensor api object
			// remember it

		} else {
			// remember it

		}
	}

	// Device removed callback //////////////////////////////////////////////////
	//
	//
	function tradfri_deviceRemoved(instanceId) {
		// clean up
		delete that.trApiLightbulbs[instanceId]
		that.log.info("Device removed: %s", instanceId)
	}

	// Group updated callback //////////////////////////////////////////////////
	//
	//
	function tradfri_groupUpdated(group) {
		
		// Create the Groups or update them
		if (!that.trApiGroups[group.instanceId]) {

			// fill the node-tradfri-client groups api object
			that.trApiGroups[group.instanceId] = group

			that.log.info('new Group %s found',group.instanceId)
			var tgroup = new TradfriGroup(that,group.instanceId)		// (plugin, id)
		} else {
			
			// update the node-tradfri-client groups api object
			that.trApiGroups[group.instanceId] = group
			that.log.debug('update Group %s',group.instanceId)
		}
		
	}
		
	// Group removed callback //////////////////////////////////////////////////
	//
	//
	function tradfri_groupRemoved(instanceId) {
		// clean up
		delete that.trApiGroups[instanceId]
		that.log.info("Group removed: %s", instanceId)
	}

	// Scene updated callback //////////////////////////////////////////////////
	//
	//
	function tradfri_sceneUpdated(groupId, scene) {
		// Create the Scenes or update them

		if (!that.trApiScenes[groupId]){
			that.trApiScenes[groupId] = []
		}

		var sId = hazScene(groupId, scene.instanceId)

		if (sId === 'false') {

			if (scene.name === 'RELAX') {
				that.trApiScenes[groupId][0] = scene
			} else if (scene.name === 'EVERYDAY') {
				that.trApiScenes[groupId][1] = scene
			} else if (scene.name === 'FOCUS') {
				that.trApiScenes[groupId][2] = scene
			} else{
				that.trApiScenes[groupId].splice(3, 0, scene)
			}

			that.log.info('new Scene %s found for Group %s', scene.name, that.trApiGroups[groupId].instanceId)

		} else {
			
			that.trApiScenes[groupId][parseInt(sId)] = scene

			that.log.debug('update Scene %s for Group %s', scene.name, that.trApiGroups[groupId].instanceId)

		}
	}
		
	// Scene removed callback //////////////////////////////////////////////////
	//
	//
	function tradfri_sceneRemoved(groupId, instanceId) {
		// clean up

		var sId = hazScene(groupId, instanceId)
		
		if (sId !== 'false') {

			that.trApiScenes[groupId].splice(sId, 1)

			that.log.info("Scene %s removed from Group %s", instanceId, groupId)

		}
	}


	// Tradfri error callback //////////////////////////////////////////////////
	//
	//
	function tradfri_error(e) {
		// clean up
		that.log.error("An error was observed: %s", e)
	}


	// Tradfri health check /////////////////////////////////////////////////////
	//
	//
	function tradfri_health() {
		that.tradfri.ping()
			.then((result) => {
				if (result == true) {
					that.log.debug("Gateway alive")
				} else {
					that.log.error("Gateway unreachable, try to reconnect")
					that.reconnect()
				}
			})
			.catch((e) => {
				that.log.error("Gateway Ping error: %s", e)
			});
	}

	// Is there a Scene ... /////////////////////////////////////////////////////
	//
	//
	function hazScene(groupId, sceneId) {
		var result = 'false'	
		that.trApiScenes[groupId].some(function (scene, idx){
				if (scene.instanceId === sceneId) {
					result = String(idx)
				}
			})
		return result
	}
}

// for compatibility with the other HVL PlugIn's
TradfriPlatform.prototype.myDevices = function() {

	// return my Devices here
	var result = []

	result.push({"id":"sep-trad","name":"--------- Tradfri Devices ---------","type":"seperator"})

	for(var index in this.trApiLightbulbs) {
		let light = this.trApiLightbulbs[index]
		result.push({"id": 'Tradfri' + light.instanceId,"name":light.name,"udn": 'Tradfri' + light.instanceId,"type":"TRADFRI"})
	}

	for(var index in this.trApiGroups) {
		let group = this.trApiGroups[index]
		result.push({"id": 'Tradfri' + group.instanceId,"name":group.name,"udn": 'Tradfri' + group.instanceId,"type":"TRADFRI"})
	}

	return result
}


TradfriPlatform.prototype.showSettings = function(dispatched_request) {
	var result = [];
	result.push({"control":"text","name":"tradfri_securityid","label":"Security ID","value":this.securityID,"description":this.localization.localize("See backside of your bridge")});
	result.push({"control":"text","name":"tradfri_ip","label":"Bridge IP","value": this.bridgeIp });
	return result;
}

TradfriPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var tradfri_securityid = settings.tradfri_securityid;
	var tradfri_ip = settings.tradfri_ip;
	
	if (tradfri_securityid) {
		this.securityID = tradfri_securityid;
		// As requested by IKEA do not save the Code
	}

	if (tradfri_ip) {
		this.bridgeIp = tradfri_ip;
		this.configuration.setValueForPlugin(this.name,"tradfri_ip",tradfri_ip); 
	}

	this.reconnect()
}


TradfriPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {

	var template = 'index.html'
	var requesturl = dispatchedRequest.request.url
	var queryObject = url.parse(requesturl, true).query
	var deviceList = ''
	var groupList = ''
	var sceneList = ''
	var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
	var devtemplate_groups = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_groups_tmp.html",null);
	var devtemplate_scenes = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_scenes_tmp.html",null);
	var cfg_handled = false
	
	if (queryObject['do'] !== undefined) {
		switch (queryObject['do']) {

		case 'app.js':
			{
			template = 'app.js'
			}
			break

		}
	}

	for(var index in this.trApiLightbulbs) { 
		deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{
			"device_hmdevice": String('Tradfri' + this.trApiLightbulbs[index].instanceId),
			"device_name": this.trApiLightbulbs[index].name,
			"device_type": this.trApiLightbulbs[index].deviceInfo.modelNumber,
			"device_spectrum": this.trApiLightbulbs[index].lightList[0]._spectrum,
		});
	}

	for(var index in this.trApiGroups) { 
		groupList = groupList +  dispatchedRequest.fillTemplate(devtemplate_groups,{
			"group_hmdevice": String('Tradfri' + this.trApiGroups[index].instanceId),
			"group_name": this.trApiGroups[index].name,
		});
	}

	for(var group in this.trApiScenes) {
		var that = this
		this.trApiScenes[group].some(function (scene,idx){
			if (idx == 0){
				sceneList = sceneList +  dispatchedRequest.fillTemplate(devtemplate_scenes,{
					"scene_group_id": 'Tradfri' + that.trApiGroups[group].instanceId,
					"scene_group_name": that.trApiGroups[group].name,
					"group_hm_ch": 'MOOD_RELAX',
					"group_scene_name": scene.name,
				})
			} else if (idx == 1){
				sceneList = sceneList +  dispatchedRequest.fillTemplate(devtemplate_scenes,{
					"scene_group_id": 'Tradfri' + that.trApiGroups[group].instanceId,
					"scene_group_name": that.trApiGroups[group].name,
					"group_hm_ch": 'MOOD_EVERYDAY',
					"group_scene_name": scene.name,
				})
			} else if (idx == 2){
				sceneList = sceneList +  dispatchedRequest.fillTemplate(devtemplate_scenes,{
					"scene_group_id": 'Tradfri' + that.trApiGroups[group].instanceId,
					"scene_group_name": that.trApiGroups[group].name,
					"group_hm_ch": 'MOOD_FOCUS',
					"group_scene_name": scene.name,
				})
			} else {
				sceneList = sceneList +  dispatchedRequest.fillTemplate(devtemplate_scenes,{
					"scene_group_id": 'Tradfri' + that.trApiGroups[group].instanceId,
					"scene_group_name": that.trApiGroups[group].name,
					"group_hm_ch": 'MOOD_' + String(idx - 2),
					"group_scene_name": scene.name,
				})
			}
		})
	}

	dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList, 'listGroups': groupList, 'listScenes': sceneList})
}

TradfriPlatform.prototype.shutdown = function() {
	this.log.info("Shutdown")

	if ( this.heartBeatId != 'undefined' ){
		clearInterval(this.heartBeatId)
		this.log.info("Heartbeat stopped")
	}

	if ( this.tradfri != undefined ){
		this.tradfri.destroy()
		this.log.info("API destroyed")
	}

	this.server.getBridge().deleteDevicesByOwner(this.name)
	this.trApiLightbulbs = {}
	this.trApiGroups = {}
	this.trApiScenes = {}
}



module.exports = TradfriPlatform
