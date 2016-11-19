"use strict";

var debug = require('debug')('HomeMaticHueBridge.Channel');
var ParameterSet = require("./ParameterSet.js").ParameterSet;
var Parameter = require("./Parameter.js").Parameter;
const EventEmitter = require('events');
const util = require('util');

var Channel = function(parent_adr,parent_type,adress,type,flags,direction,jps,version) {
  this.adress = parent_adr + ":" + adress;
  this.index = adress;
  this.parent_adress = parent_adr;
  this.parent_type = parent_type;
  this.type = type;
  this.flags = flags;
  this.direction = direction;
  this.datapoints = [];
  this.version = version;
  this.paramsets = [];
  
  var that = this;
  jps.forEach(function (pSet) {
  	
  	
    var ps = new ParameterSet(pSet["name"],pSet["id"]);
    var parameter = pSet["parameter"];
    if (parameter != undefined) {
      
      parameter.forEach(function (jParameter) {
    	var p = new Parameter(jParameter);
    	ps.addParameter(p);
      });
    }
    that.paramsets.push(ps);
    
    ps.on('parameter_value_change', function(parameter){
	  parameter["channel"] = that.adress;
      that.emit('channel_value_change', parameter);
    })
  });
  
  EventEmitter.call(this);
}  

util.inherits(Channel, EventEmitter);

  
  Channel.prototype.addDataPoint = function(datapoint) {
    this.datapoints.push(datapoint);
  }


  Channel.prototype.getChannelDescription = function(paramset) {
   
   var result = {};
   var psetNames = [];

   this.paramsets.forEach(function (pSet) {
    psetNames.push(pSet.name);
   })

   result['TYPE'] = this.type;
   result['ADDRESS'] = this.adress;
   result['RF_ADDRESS'] = 0;
   result['PARENT'] = this.parent_adress;
   result['PARENT_TYPE'] = this.parent_type;
   result['INDEX'] = this.index;
   result['UPDATABLE'] = true;
   result['FLAGS'] = this.flags;
   result['DIRECTION'] = this.direction;
   result['LINK_SOURCE_ROLES'] = undefined;
   result['LINK_TARGET_ROLES'] = undefined;
   result['VERSION'] = this.version;
   result['PARAMSETS'] = psetNames;
 
   return result;
 }


 Channel.prototype.getParamsetDescription = function(paramset) {
  var result = [];
  
  if (paramset == this.adress) {
    paramset = "LINKS";
    debug("Link paramset Request")
  }
  
  this.paramsets.forEach(function (pSet) {
	  debug("We have here : %s",pSet.name)

    if (pSet.name == paramset) {
		debug("Paramset %s found" +  pSet.name);
		result = pSet.getParamsetDescription();
    }
   });
   return result;
 }

 Channel.prototype.getParamset = function(paramset) {
  var result = [];

  if (paramset == this.adress) {
    paramset = "LINKS";
  }

  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
      result = pSet.getParamset();
    }
   });
   return result;
 }


Channel.prototype.putParamset = function(paramset,parameter) {
  
  if (paramset == undefined) {
    paramset = "MASTER";
  }

  if (paramset == this.adress) {
    paramset = "LINKS";
  }
  
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
     	for (var key in parameter) {
          var value = parameter[key];
       	  pSet.putParamsetValue(key,value);
        }
    }
  });

 }

Channel.prototype.getParameterObject = function(parameterName) {
  var result = undefined;
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
      result = pSet.getParameterObject(parameterName);
    }
   });
  return result;
}

Channel.prototype.getValue = function(parameterName) {
  var result = [];
  debug("Channel getValue " + this.adress + " " + parameterName);
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
      result = pSet.getValue(parameterName);
      debug("Channel getValue result is " + JSON.stringify(result));
    }
   });
   return result;
}
 

Channel.prototype.setValue = function(parameterName,value) {
  var result = [];
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
      result = pSet.setValue(parameterName,value);
    }
   });
   return result;
}
  
Channel.prototype.updateValue = function(parameterName,value,notification) {

  var pv = this.getParameterObject(parameterName);
  if (pv!=undefined) {
     pv.value = value;
  
     if (notification!=undefined) {
	   this.publishUpdateEvent([pv]);
     }

  }
}



Channel.prototype.startUpdating = function(parameterName) {
 
  var pw = this.getParameterObject("WORKING");
  var upChannels = [];
  if (pw!=undefined) {
	this.setValue("WORKING",true);
	upChannels.push(pw);
  }
  
  var pv = this.getParameterObject(parameterName);
  if (pv!=undefined) {
	upChannels.push(pv);
  }
  
  this.publishUpdateEvent(upChannels);
}



Channel.prototype.endUpdating = function(parameterName) {
  var pw = this.getParameterObject("WORKING");
  var upParameters = [];
  if (pw!=undefined) {
	this.setValue("WORKING",false);
	upParameters.push(pw);
  }
  
  var pv = this.getParameterObject(parameterName);
  if (pv!=undefined) {
	upParameters.push(pv);
  }
  
  this.publishUpdateEvent(upParameters);
}

Channel.prototype.publishUpdateEvent = function(parameterNames) {
  this.emit('event_channel_value_change', {channel:this.adress,parameters:parameterNames});
}


Channel.prototype.getParamsetId = function(paramset) {
  var result = [];

  if (paramset == this.adress) {
    paramset = "LINKS";
  }

  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramset) {
      result = pSet.getParamsetId();
    }
   });
   return result;
}


module.exports = {
  Channel : Channel
}
