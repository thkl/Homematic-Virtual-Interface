"use strict";

var fs = require('fs');


var Config = function() {

	try {
    	var buffer = fs.readFileSync("config.json");
    	this.settings = JSON.parse(buffer.toString());
	} catch (e) {

	}

}



module.exports = {
  Config : Config
}
