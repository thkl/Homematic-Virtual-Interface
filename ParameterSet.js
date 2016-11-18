"use strict";

var debug = require('debug')('HomeMaticHueBridge.ParameterSet');
const EventEmitter = require('events')
const util = require('util')


var ParameterSet = function(name,id) {
  this.name = name;
  this.parameter = [];
  this.id = id;
  EventEmitter.call(this)
}

util.inherits(ParameterSet, EventEmitter)


ParameterSet.prototype.addParameter = function(sparameter) {
  this.parameter.push(sparameter);
}


ParameterSet.prototype.getParamsetDescription = function() {
  var result = {};
   this.parameter.forEach(function (p) {
     result[p.name] = p.getDescription();
   });
  return result;
}

ParameterSet.prototype.getParamsetId = function() {
  return this.id;
}


ParameterSet.prototype.getParamset = function() {
  var result = {};
   this.parameter.forEach(function (p) {
     result[p.name] = p.getPValue();
   });
  return result;
}

ParameterSet.prototype.putParamsetValue = function(parameter,value) {
   this.parameter.forEach(function (p) {
     if (p.name == parameter) {
       p.value = value;
     }
   });
}


ParameterSet.prototype.getValue = function(parameterName) {
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


ParameterSet.prototype.getParameterObject = function(parameterName) {
   var result;
   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
	     result = p;
	 }
   });
  return result;
}


ParameterSet.prototype.setValue = function(parameterName,value) {
   var that = this;

   this.parameter.forEach(function (p) {
     if (p.name == parameterName) {
        var oldValue = p.value;
        p.value=value;
	    that.emit('parameter_value_change', {name:parameterName , oldValue:oldValue, newValue:value });
     }
   });
}

ParameterSet.prototype.updateValue = function(parameterName,value) {
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
  ParameterSet : ParameterSet
}



