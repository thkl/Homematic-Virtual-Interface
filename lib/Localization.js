
//
//  Localization.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 22.01.17.
//  Copyright © 2017 kSquare.de. All rights reserved.
//



module.exports = function (strings) {

	var logger = require(__dirname + "/logger.js").logger("Homematic Virtual Interface.Server");
	var fs = require('fs');
    var module = {};
    this.language = "en-en";
    
    logger.info("Trying to load Localization from %s",strings);
    try {
	    if (fs.existsSync(strings)) {
			module.string_obj = JSON.parse(fs.readFileSync(strings, "binary"));
		}
	}
	catch (e) {
		// String File not found
		logger.error(e.stack);
		logger.error("Strings not found %s",strings);
	}
	
	module.setLanguage = function (dispatched_request) {
     	this.language = dispatched_request.language;
    }
	
	
	module.getLanguage = function () {
     	return this.language;
    }
	
	module.getLocalizedStringFromModuleJSON = function (element) {
     	if (element[this.language]) {
	     	return element[this.language]
     	} else {
	     	return element['en-en']
     	}
    }
	
	
    module.localize = function (input) {
		var result = input;
		if (module.string_obj) {
		var loc_strings = module.string_obj.strings[this.language];
		if (loc_strings) {
			var loc = loc_strings[input];
			if (loc) {
				
				return loc;
			}
		}
		}
		
		return result;
    };

    return module;
};