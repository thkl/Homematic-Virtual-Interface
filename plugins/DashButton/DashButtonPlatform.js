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
var pcap = require('pcap')

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
  this.foundItems = []
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
  if (btns != undefined) {
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
}

DashButtonPlatform.prototype.hazButtonWithMac = function (mac) {
  var result = false
  this.buttons.some(function(hmdevice){
  if (hmdevice.buttonMac === mac) {
 	   result = true
	}
  })
  return result
} 
 
// Dash Detechtion from node_dash_button

DashButtonPlatform.prototype.create_session = function (iface, protocol) {
    var filter;
    switch(protocol) {
        case 'all':
            filter = 'arp or ( udp and ( port 67 or port 68 ) )';
            break;
        case 'udp':
            filter = 'udp and ( port 67 or port 68 )';
            break;
        default:
            filter = 'arp';
    }

    try {
        var session = pcap.createSession(iface, filter);
    } catch (err) {
        this.log.error(err);
        this.log.error("Failed to create pcap session: couldn't find devices to listen on.\n" + "Try running with elevated privileges via 'sudo'");
    }
    return session;
}


DashButtonPlatform.prototype.int_array_to_hex = function (int_array) {
    var hex = "";
    for (var i in int_array){
        var h = int_array[i].toString(16); // converting to hex
        if (h.length < 2) {h = '0' + h}; //adding a 0 for non 2 digit numbers
        if (i !== int_array.length) {hex+=":"}; //adding a : for all but the last group
        hex += h;
    }
    return hex.slice(1);//slice is to get rid of the leading :
};

DashButtonPlatform.prototype.installCheck = function () {
	var that = this
	var iface = undefined
	this.foundItems = []
	var manufacturer_directory = require(__dirname+'/stor.js').manufacturer_directory;
	
	this.pcap_session = this.create_session(iface, 'all')
	
	this.pcap_session.on('packet', function(raw_packet) {
    var packet = pcap.decode.packet(raw_packet); //decodes the packet
    if(packet.payload.ethertype === 2054 || packet.payload.ethertype === 2048) { //ensures it is an arp or udp packet
        var protocol, possible_dash;
        if (packet.payload.ethertype === 2054) {
            protocol = 'arp';
            possible_dash = packet.payload.payload.sender_ha.addr; //getting the hardware address of the possible dash
        }
        else {
            protocol = 'udp';
            possible_dash =  packet.payload.shost.addr;
        }
        possible_dash = that.int_array_to_hex(possible_dash);

        var log = 'Possible dash hardware address detected: {0} Manufacturer: {1} Protocol: {2}',
            manufacturerKey = possible_dash.slice(0,8).toString().toUpperCase().split(':').join(''),
            manufacturer;

        if(manufacturer_directory.hasOwnProperty(manufacturerKey)) {
          manufacturer = manufacturer_directory[manufacturerKey];
        } else {
          manufacturer = 'unknown';
        }
	
		if (manufacturer.toLowerCase().indexOf('amazon')>-1) {
			if ((that.foundItems.indexOf(possible_dash)==-1) && (that.hazButtonWithMac(possible_dash) === false)) {
		        that.foundItems.push(possible_dash)
	        }
        }
    }
	});
}

DashButtonPlatform.prototype.closeInstallSession = function() {
	this.log.info(JSON.stringify(this.foundItems))
		if (this.pcap_session != undefined) {
			this.pcap_session.close()
		}
	this.pcap_session=undefined	
}

DashButtonPlatform.prototype.addButton = function(serial,mac) {

	var btns =  this.configuration.getValueForPlugin(this.name,'buttons')
	if (btns == undefined) { 
	    btns = []
	}
	
	btns.push({'serial':serial,'mac':mac})
	this.configuration.setValueForPlugin(this.name,'buttons',btns)
	this.reloadButtons()
}

DashButtonPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  var newdeviceList = ''
  var that = this
  if (queryObject['do'] !== undefined) {
    switch (queryObject['do']) {

	  case 'install':
	  {
		 this.installCheck()
		 template = 'install.html'
	  }

	   break

	  case 'stop':
	  {
		this.closeInstallSession()
		var deviceList = ''
		var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp_new.html",null);
		this.foundItems.some(function (mac){
			let dashId = mac.substring(12, 14) + mac.substring(15, 17)
			newdeviceList = newdeviceList +  dispatchedRequest.fillTemplate(devtemplate,{"device_id":dashId,"device_mac":mac});
		});
	  } 
	  break
	  
	  case 'add':
	  {
		  let buttonId = queryObject['id']
		  let buttonMac = queryObject['mac']
		  if ((buttonId !== undefined) && (buttonMac !== undefined)) {
			  this.addButton(buttonId,buttonMac)
		  }
	  }
  		break
      
      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  }

  var devtemplate = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_device_tmp.html",null);
  this.buttons.some(function (hmdevice){
	let mac = hmdevice.buttonMac
	let dashId = mac.substring(12, 13) + mac.substring(15, 16)
	deviceList = deviceList +  dispatchedRequest.fillTemplate(devtemplate,{"device_id":hmdevice.serialNumber,"device_mac":mac});
  });

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList,'listNewDevices': newdeviceList})
}

module.exports = DashButtonPlatform
