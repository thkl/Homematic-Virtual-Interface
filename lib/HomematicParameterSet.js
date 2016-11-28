//
//  HomematicParameterSet.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

"use strict";

const EventEmitter = require('events')
const util = require('util')
var Logger = require(__dirname + '/Log.js').Logger;
var logger = new Logger("HomematicParameterSet");


var HomematicParameterSet = function(name,id) {
  //logger.debug("Create new Paramset %s" , name)
  this.name = name;
  this.parameter = [];
  this.id = id;
  EventEmitter.call(this)
}

util.inherits(HomematicParameterSet, EventEmitter)


HomematicParameterSet.prototype.addParameter = function(sparameter) {
  this.parameter.push(sparameter);
}


HomematicParameterSet.prototype.getParamsetDescription = function() {
  var result = {};
   this.parameter.forEach(function (p) {
     result[p.name] = p.getDescription();
   });
  return result;
}

HomematicParameterSet.prototype.getParamsetId = function() {
  return this.id;
}


HomematicParameterSet.prototype.getParamset = function() {
  var result = {};
   this.parameter.forEach(function (p) {
     result[p.name] = p.getPValue();
   });
  return result;
}

HomematicParameterSet.prototype.putParamsetValue = function(parameter,value) {
   this.parameter.forEach(function (p) {
     if (p.name == parameter) {
       p.value = value;
     }
   });
}


HomematicParameterSet.prototype.getValue = function(parameterName) {
   var result;

   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
	     result = p.value;
    	 switch(p.type) {
     
     	case "FLOAT":
	    	result = {"explicitDouble":p.value};
	     break;
     
    	 case "BOOL":
			result =  (p.value == 0) ? false:true;
     	break;
     }
	}
   });
  return result;
}


HomematicParameterSet.prototype.getParameterObject = function(parameterName) {
   var result;
   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
	     result = p;
	 }
   });
  return result;
}


HomematicParameterSet.prototype.setValue = function(parameterName,value) {
   var that = this;

   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
        var oldValue = p.value;
        p.value=value;
	    that.emit('parameter_value_change', {name:parameterName , oldValue:oldValue, newValue:value });
     }
   });
}

HomematicParameterSet.prototype.updateValue = function(parameterName,value) {
   var that = this;
   var result = undefined;
   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
        p.value=value;
        result = p;
     }
   });
   return result;
}


module.exports = {
  HomematicParameterSet : HomematicParameterSet
}



