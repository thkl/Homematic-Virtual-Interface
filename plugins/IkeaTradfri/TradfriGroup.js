'use strict'

var HomematicDevice;

var TradfriGroup = function(plugin, id) {

	var that = this

	this.api =  plugin.tradfri

	this.trApiLightbulbs = plugin.trApiLightbulbs
	this.trApiScenes = plugin.trApiScenes
	this.trApiGroups = plugin.trApiGroups
	this.trApiGroup = plugin.trApiGroups[id]
	this.log = plugin.log
	this.bridge = plugin.server.getBridge()
	this.plugin = plugin
	
	HomematicDevice = plugin.server.homematicDevice
	
	this.id = id
	this.onTime = 0
	this.lastLevel = 0
	this.defaultTransitiontime = 0.5
	this.transitiontime = this.defaultTransitiontime

	this.hmGroup = new HomematicDevice(this.plugin.getName())
	this.serial = 'Tradfri'+this.id

	this.HMType = 'VIR-LG-GROUP_Tradfri'
	this.HMChannel = 'VIR-LG_GROUP-CH'
	
	this.log.debug('Group: Setup new Tradfri %s',this.serial)

	var data = this.bridge.deviceDataWithSerial(this.serial)

	if (data!=undefined) {
		this.hmGroup.initWithStoredData(data)
	}

	if (this.hmGroup.initialized === false) {
		this.hmGroup.initWithType(this.HMType, this.serial)
		this.hmGroup.serialNumber = this.serial
		this.bridge.addDevice(this.hmGroup,true)
	} else {
		this.bridge.addDevice(this.hmGroup,false)
	}

	
	// Update Tradfri Gateway Devices on Homematic changes //////////////////////////////////////////////////
	//
	//
	//
	this.hmGroup.on('device_channel_value_change', function(parameter){

		// that.log.debug('Homematic change event %s recieved: %s, update Tradfri Group', parameter.name, parameter.newValue)

		var newValue = parameter.newValue
		var channel = that.hmGroup.getChannel(parameter.channel)

		if (parameter.name == 'INSTALL_TEST') {

			that.setLevel(1)

			setTimeout(function(){
				that.setLevel(0)
				channel.endUpdating('INSTALL_TEST')
			}, 1000)
		}


		if (parameter.name == 'LEVEL') {
			
			that.setLevel(newValue)

			if (( that.onTime > 0 ) && ( newValue > 0 )) {
				setTimeout(function() {that.setLevel(0)}, that.onTime * 1000)
			}

			// reset the transition and on time
			that.transitiontime = that.defaultTransitiontime
			that.onTime = 0

			if (newValue > 0) {
				that.lastLevel = newValue
			}

		}


		if (parameter.name == 'OLD_LEVEL') {

			if (newValue==true) {
				if (that.lastLevel == 0) {
					that.lastLevel = 1
				}
				that.setLevel(that.lastLevel)

				// reset the transition time
				that.transitiontime = that.defaultTransitiontime

			}
		}


		if ((parameter.name == 'RAMP_TIME') && (channel.index == '1')) {
			that.transitiontime = newValue*10
		}


		if ((parameter.name == "ON_TIME") && (channel.index == '1')) {
			that.onTime = newValue
		}


		if (parameter.name.includes("MOOD_")) {

			var ch = parameter.name.split('_')

			var moodCh = 'undefined'

			// choose the correct channel index
			switch (ch[1]) {
				case 'RELAX':
					moodCh = 0
					break
				case 'EVERYDAY':
					moodCh = 1
					break
				case 'FOCUS':
					moodCh = 2
					break
				default:
					moodCh = parseInt(ch[1]) + 2
			}

			that.setScene(moodCh)
			
			// reset the transition time
			that.transitiontime = that.defaultTransitiontime

		}

		if (parameter.name == 'WHITE') {
			
			that.setWhite(newValue)

			// reset the transition time
			that.transitiontime = that.defaultTransitiontime

		}

	})

	// Update Homematic Devices on Tradfri Gateway changes //////////////////////////////////////////////////
	// cause the Gateway won't send updates on this we react on bulb changes
	//
	//
	that.api.on('device updated', function(parameter){

		// if the changing device is a member of the group we want to observe, call the update function
		that.trApiGroup.deviceIDs.some(function (deviceID){
			if (deviceID == parameter.instanceId) {
				// that.log.debug('Tradfri Group change event recieved, update Homematic')
				var di_channel = that.hmGroup.getChannelWithTypeAndIndex(that.HMChannel,'1')
				that.updateHM( di_channel, parameter )
			}
		})
	})

	// first time initialise on plugin startup
	// that.log.debug('HM group first time init %s', that.id)
	var in_channel = that.hmGroup.getChannelWithTypeAndIndex(that.HMChannel,'1')
	that.updateHM( in_channel, that.trApiGroup )
	

}


// Set the white spectrum on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriGroup.prototype.setWhite = function(newValue) {

	var that = this

	var newTemp = 100 - (( newValue - 2200 ) / 18 ) // bring to 0 - 100

	that.trApiGroup.deviceIDs.some(function (deviceID){

		for(var index in that.trApiLightbulbs) {

			if (index == deviceID) {

				if (that.trApiLightbulbs[index].lightList[0]._spectrum == 'white') {

					that.api.operateLight(that.trApiLightbulbs[index], { colorTemperature: newTemp, transitionTime: that.transitiontime, }).then((result) => {
						// that.log.debug('Tradfri %s Colortemp %s: %s', that.trApiLightbulbs[index].name, newTemp, result)
					}).catch((error) => {
						that.log.error('Tradfri setWhite %s',error);
					})
					
				}
			}
		}
	})
}


// Set the level on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriGroup.prototype.setLevel = function(newLevel) {

	newLevel = newLevel * 100 // bring to 0 - 100

	var OnOff = false

	if (newLevel != 0) {
		OnOff = true
	}

	this.api.operateGroup(this.trApiGroups[this.id], { onOff: OnOff, dimmer: newLevel, transitionTime: this.transitiontime, }).then((result) => {
		// this.log.debug('Tradfri Group %s Level %s', this.id, newLevel)
	}).catch((error) => {
		this.log.error('Tradfri Group setLevel %s',error)
	})
}

// Set the level on the Gateway //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriGroup.prototype.setScene = function(moodCh) {
	
		var moodId = 'undefined'
		var moodName = 'undefined'

		this.trApiScenes[this.trApiGroup.instanceId].some(function (scene,idx){
			if (idx == moodCh){
				moodId = scene.instanceId
				moodName = scene.name
			}
		})

		if (moodId !== 'undefined') {
			this.api.operateGroup(this.trApiGroups[this.id], { sceneId: moodId, transitionTime: this.transitiontime, }).then((result) => {
				// this.log.debug('Tradfri Group %s Scene %s with Name %s set', this.trApiGroup.instanceId, moodId, moodName)
			}).catch((error) => {
				this.log.error('Tradfri Group setScene %s',error)
			})
		}
	}

// update the dataset on the Homematic //////////////////////////////////////////////////////////////////////////////////
//
//
//
TradfriGroup.prototype.updateHM = function(di_channel, parameter) {

	var that = this

	var hmLevel = 0
	var hmTemp = 0
	var count = 0

	// Get the brightest (and warmest) group bulb to set the group brightness cause the tradfri Gateway won't update those
	this.trApiGroup.deviceIDs.some(function (deviceID){
		for(var index in that.trApiLightbulbs) {
			if (index == deviceID) {

				if ((that.trApiLightbulbs[index].lightList[0].onOff) && (that.trApiLightbulbs[index].alive == true)) {

					if (hmLevel < that.trApiLightbulbs[index].lightList[0].dimmer) {

						hmLevel = that.trApiLightbulbs[index].lightList[0].dimmer

					}

				} 

				if ((that.trApiLightbulbs[index].lightList[0]._spectrum == 'white') && (that.trApiLightbulbs[index].alive == true)) {

					count = count + 1
						
					hmTemp = hmTemp + that.trApiLightbulbs[index].lightList[0].colorTemperature

				}
			}
		}
	})

	hmTemp = hmTemp / count
	hmTemp = ( 100 - hmTemp ) * 18 + 2200 // bring to 2200 - 4000
	hmLevel = hmLevel / 100		// bring to 0 - 1

	if (di_channel != undefined) {

		// that.log.debug('HM Group %s %sK based on Bulbs in Group', hmLevel, hmTemp)
		di_channel.updateValue('LEVEL', parseFloat(hmLevel), true, true)
		di_channel.updateValue('WHITE', parseInt(hmTemp), true, true)
	}

}

module.exports = {
	TradfriGroup : TradfriGroup
}
