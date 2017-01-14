"use strict";
//
//  HomematicChannel.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
var HomematicParameterSet = require(__dirname + "/HomematicParameterSet.js").HomematicParameterSet;
var HomematicParameter = require(__dirname + "/HomematicParameter.js").HomematicParameter;
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("HomematicChannel");
const EventEmitter = require('events');
const util = require('util');

var HomematicChannel = function(parent_adr,parent_type,adress,type,flags,direction,jps,version) {
  adress = adress.replace(/[ ]/g,'_');
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
  
  
  logger.debug("creating new channel " + this.adress + " of type " + this.type);
  
  var that = this;
  jps.forEach(function (pSet) {
  	
  	
    var ps = new HomematicParameterSet(pSet["name"],pSet["id"]);
    var parameter = pSet["parameter"];
    if (parameter != undefined) {
      
      parameter.forEach(function (jParameter) {
    	var p = new HomematicParameter(jParameter);
    	ps.addParameter(p);
      });
    }
    that.paramsets.push(ps);
    
    ps.on('parameter_value_change', function(parameter){
	  parameter["channel"] = that.adress;
	  logger.debug("Parameter value change event %s",parameter.name);
      that.emit('channel_value_change', parameter);
    })
  });
  
  EventEmitter.call(this);
}  

util.inherits(HomematicChannel, EventEmitter);

  
HomematicChannel.prototype.addDataPoint = function(datapoint) {
    this.datapoints.push(datapoint);
  }


HomematicChannel.prototype.getChannelDescription = function(paramset) {
   
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
   result['AES_ACTIVE'] = 0;
 
   return result;
 }


HomematicChannel.prototype.getParamsetDescription = function(paramset) {
  var result = [];
  
  if (paramset == this.adress) {
    paramset = "LINKS";
  }
  
  this.paramsets.forEach(function (pSet) {

    if (pSet.name == paramset) {
		result = pSet.getParamsetDescription();
    }
   });

   return result;
 }

 HomematicChannel.prototype.getParamset = function(paramset) {
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


HomematicChannel.prototype.putParamset = function(paramset,parameter) {
  
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
  return this.getParamset(paramset);
 }

HomematicChannel.prototype.getParameterObject = function(parameterName) {
  var result = undefined;
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
      result = pSet.getParameterObject(parameterName);
    }
   });
  return result;
}

HomematicChannel.prototype.getValue = function(parameterName) {
 var result = [];
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
      result = pSet.getValue(parameterName);
    }
   });
   return result;
}

HomematicChannel.prototype.getParamsetValue = function(paramsetName,parameterName) {
  var result = [];
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramsetName) {
      result = pSet.getJSONValue(parameterName);
    }
   });
   return result;
}

HomematicChannel.prototype.getParamsetValueWithDefault = function(paramsetName,parameterName,defaultValue) {
  var result = defaultValue;
  var that = this;
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == paramsetName) {
      result = pSet.getValue(parameterName);
    }
   });
   return result;
}
 

HomematicChannel.prototype.setValue = function(parameterName,value) {
  var result = [];
  this.paramsets.forEach(function (pSet) {
    if (pSet.name == "VALUES") {
	    logger.debug("Channel set Value %s to %s",parameterName,value)
		result = pSet.setValue(parameterName,value);
    }
   });
   return result;
}
  
HomematicChannel.prototype.updateValue = function(parameterName,value,notification,force) {
  var pv = this.getParameterObject(parameterName);
  if (pv!=undefined) {
	    logger.debug("Channel update Event");
	  // Only call once !
	 if ((pv.value != value) || (force)) {
	     pv.value = value;
		 if (notification!=undefined) {
			 this.publishUpdateEvent([pv]);
     	}
	 } else {
		 logger.debug("Ignore Value Change %s.%s event because the value doesnt change %s vs %s",this.adress,parameterName,pv.value,value);
	 } 
  } else {
	    logger.warn("ParameterObject for %s not found",parameterName);
  }
}



HomematicChannel.prototype.startUpdating = function(parameterName) {
 
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



HomematicChannel.prototype.endUpdating = function(parameterName) {
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

HomematicChannel.prototype.publishUpdateEvent = function(parameterNames) {
  this.emit('event_channel_value_change', {channel:this.adress,parameters:parameterNames});
  this.emit('logicevent_channel_value_change', {channel:this.adress,parameters:parameterNames});
}


HomematicChannel.prototype.getParamsetId = function(paramset) {
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
  HomematicChannel : HomematicChannel
}
