"use strict";

var debug = require('debug')('HomeMaticHueBridge.Parameter');

var HomematicParameter = function(jsonElement) {
  
  this.name = jsonElement["name"];
  this.type = jsonElement["type"];
  this.max = jsonElement["max"];
  this.min = jsonElement["min"];
  this.vdefault= jsonElement["vdefault"];
  this.control = jsonElement["control"]
  this.flags = jsonElement["flags"];
  this.operations = jsonElement["operations"];
  this.tab_order = jsonElement["tab_order"];
  this.unit = jsonElement["unit"];
  this.valuelist = jsonElement["valuelist"];
  this.value =   this.vdefault;
 // debug("Adding Parameter " +  this.name);
}

HomematicParameter.prototype.getDescription = function() {
   var result = {};
   
   if (this.control != undefined ) {
   	result['CONTROL'] = this.control;
   }

   result['FLAGS'] = this.flags;
  
   result['ID'] = this.name;
   
   switch(this.type) {
     
     case "FLOAT":
	    result['MIN'] = {"explicitDouble":this.min};
		result['MAX'] = {"explicitDouble":this.max};
		result['DEFAULT'] = {"explicitDouble":this.vdefault};
     break;
     
     case "STRING":

     break;
     
     
     default:
   	 result['MIN'] = this.min;
   	 result['MAX'] = this.max;
     result['DEFAULT'] = this.vdefault;
   }
   
   result['OPERATIONS'] = this.operations;
   result['TAB_ORDER'] = this.tab_order;
   result['TYPE'] = this.type;
   result['UNIT'] = this.unit;
   
   if (this.valuelist != undefined) {
	   result['VALUE_LIST'] = this.valuelist;
   }
   
   return result;

}

HomematicParameter.prototype.getPValue = function() {
  
  switch(this.type) {
     
     case "FLOAT":
	    return {"explicitDouble":this.value};
     break;
     
     case "BOOL":
		return (this.value == 0) ? false:true;
     break;
     
     default:
     return this.value;
   }
}


module.exports = {
  HomematicParameter : HomematicParameter
}
