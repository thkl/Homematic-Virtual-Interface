'use strict'

//
//  CCUDevice.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 10.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

var Fakelight = require(__dirname + '/device/Fakelight.js').Fakelight;
var HomematicDevice;

var CCUDevice = function (hueserver,fobject) {
	this.hueserver = hueserver;
	this.log = hueserver.log;
	this.light;
	this.hmDevice;
	this.bridge = hueserver.bridge;
	this.name = fobject["name"]
	this.objType = fobject["type"]
	this.index = fobject["index"]
	this.adress = fobject["adress"]
	this.ctype = fobject["ctype"]
	this.isReal = false;
	this.rpcClient = this.hueserver.plugin.hm_layer.addRPCClient("BidCos-RF")
	this.log.debug("CCU Device Data %s",JSON.stringify(fobject))
	this.init();
}	
	
	
CCUDevice.prototype.init = function() {
  var that = this;
  this.light = new Fakelight(this.log,this.index,this.name,false)
  this.initRealDevice()
  this.hueserver.addLightDevice(this);
}

CCUDevice.prototype.initRealDevice = function(hmtype) {
  var that = this
  this.light.on("harmony_device_value_change", function(lightid,parameter,state){
	  that.log.debug("Event -> Set %s to %s Object Type %s",parameter,state,that.objType);
	  that.log.info("Emit Harmony Event %s,%s,%s",lightid,parameter,state);
	  that.bridge.emit("harmony_device_value_change",{"lightid":lightid,"parameter":parameter,"state":state});

	  if (that.objType == "3") {
	  // HM Device
	  if ((parameter=="bri") && (state > 0)) {
		if (that.ctype == "DIMMER") {
			that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"LEVEL",{"explicitDouble":(state/255)}], function(error, value) {});
  		}
	  }	   
	  
	  if (parameter == "on") {
		
		if (that.ctype == "SWITCH") {
			that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"STATE",state], function(error, value) {});
		}
		
		if (that.ctype == "DIMMER") {
			if (state == false) {
				that.bridge.callRPCMethod("BidCos-RF","setValue",[that.adress,"LEVEL",{"explicitDouble":0}], function(error, value) {});
			} else {
				
			}
  		}

	  }
	  
	  }
	  
	  // HM Program
 	 if (that.objType == "4") {
	 	if ((parameter=="on") && (state==true)) {
	 		that.bridge.runRegaScript("var x = dom.GetObject('" +  that.adress.slice(2) + "');if (x) {x.ProgramExecute();}");
	 	}
	 }
	 
	 
	 if (that.objType == "5") {
	  if (parameter == "on") {
		  that.log.debug("Var %s",that.adress)
		  var vst = (state==true) ? "1":"0"
	 	var script = "var x = dom.GetObject('" +  that.adress.slice(2) + "');if (x) {x.State(" + vst + ");}"
	 	that.bridge.runRegaScript(script);
	  }
	 }
	 
  })
}

CCUDevice.prototype.setValue = function(datapoint, value) {
   
   if (this.objType === '3') {
	   if (datapoint === 'STATE') {
		   this.light.isOn = value
	   }
	
	   if (datapoint === 'LEVEL') {
		   this.light.isOn = (value > 0)
		   this.light.bri = value*255	
	   }
	   
   }
}

CCUDevice.prototype.getType = function() {
  return this.hmDevice.type;
}

module.exports = {
  CCUDevice : CCUDevice
}
