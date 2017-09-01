'use strict'

var HomematicDevice;

var TradfriDevice = function(plugin, api ,light,serialprefix) {


		var that = this
		this.api =  api
		this.log = plugin.log
		this.bridge = plugin.server.getBridge()
		this.plugin = plugin
		
		HomematicDevice = plugin.server.homematicDevice
		
		this.id = light['id']
		this.onTime = 0
		this.lastLevel = 0
		this.curLevel = 0
		this.log.debug('Setup new Tradfri %s',serialprefix)
		this.transitiontime = 4
		
		this.hmDevice = new HomematicDevice(this.plugin.getName())

		var data = this.bridge.deviceDataWithSerial('ITFD'+this.id)
		if (data!=undefined) {
			this.hmDevice.initWithStoredData(data)
		}
		
		if (this.hmDevice.initialized === false) {
			this.hmDevice.initWithType('VIR-LG-RGBW-DIM', 'Tradfri ' + this.id)
			this.hmDevice.serialNumber = 'ITFD'+this.id
			this.bridge.addDevice(this.hmDevice,true)
		} else {
			this.bridge.addDevice(this.hmDevice,false)
		}

		this.hmDevice.on('device_channel_value_change', function(parameter){
			var newValue = parameter.newValue
			var channel = that.hmDevice.getChannel(parameter.channel)

			if (parameter.name == 'INSTALL_TEST') {
				that.setLevel(1)
				setTimeout(function(){
					that.setLevel(0)
					channel.endUpdating('INSTALL_TEST')
				}, 1000)
	      	}

	      if (parameter.name == 'LEVEL') {
	       that.setLevel(newValue);
		   if ((that.onTime > 0) && (newValue>0)) {
		    setTimeout(function() {that.setLevel(0)}, that.onTime * 1000)
	       }
	       // reset the transition and on time 
	       that.transitiontime = 4
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
	       
	       }
	       
	     }

	    if ((parameter.name == 'RAMP_TIME') && (channel.index == '1')) {
		  that.transitiontime = newValue*10
		}

	    if ((parameter.name == "ON_TIME") && (channel.index == '1')) {
		  that.onTime = newValue
		}

	    if (parameter.name == 'WHITE') {
		  that.setWhite(newValue)
	    }

    })

	     this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 1000)

	}
	
	

	TradfriDevice.prototype.setWhite = function(newTemp) {
	    var co_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (co_channel != undefined) {
			let color = 'warm'
			if (newTemp>3000) {
				color = 'normal'
			}
			if (newTemp>4500) {
				color = 'cool'
			}
			let devData = {state:'on', brightness:this.curLevel, color: color, transitionTime: this.transitiontime}
			this.log.debug('Temp %s command %s',newTemp,JSON.stringify(devData))
			this.api.setDeviceState(this.id,devData ).then(
			)
		}
	}


	TradfriDevice.prototype.setLevel = function(newLevel) {
	    var di_channel = this.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		if (di_channel != undefined) {
			di_channel.startUpdating('LEVEL');
			this.curLevel = parseInt(newLevel*255)
			di_channel.updateValue('LEVEL',newLevel)
			this.api.setDeviceState(this.id, { state: (newLevel>0) ? 'on' : 'off', brightness: parseInt(newLevel*255),transitionTime: this.transitiontime}).then(
				di_channel.endUpdating('LEVEL')
			);
		}
	}

	TradfriDevice.prototype.refreshDevice = function(device) {
	  var that = this
	  this.api.getDevice(this.id).then(function(data) {
		  that.log.debug(JSON.stringify(data));

		  if ((data != undefined) && (data.brightness != undefined)) {
		  	  var di_channel = that.hmDevice.getChannelWithTypeAndIndex('VIR-LG_RGBW-DIM-CH','1')
		  	  var bri = 0
		  	  if (data['on']==true) {
				  bri = data['brightness'] / 255;
				  that.curLevel = data['brightness']
			  }
			  di_channel.updateValue('LEVEL',bri,true);
			  
			  if (data.color=='efd275') { // 'warm'
				  di_channel.updateValue('WHITE','2000',true)
			  }
			  
			  if (data.color=='f1e0b5') {
				  di_channel.updateValue('WHITE','4250',true)
			  }
			  
			  if (data.color=='f5faf6') {
				  di_channel.updateValue('WHITE','6500',true)
			  }
			}		
	  });
	

	 this.updateTimer = setTimeout(function() {
		 	that.refreshDevice()
		 }, 20000)
	}



	module.exports = {
	  TradfriDevice : TradfriDevice
	}
