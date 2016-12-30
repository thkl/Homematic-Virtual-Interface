//
//  HueEffectServer.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 28.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var fs = require('fs');
var path = require('path');
var Logger = require(__dirname + '/../../lib/Log.js').Logger;
var logger =  Logger.withPrefix("HueEffectServer");

var HueEffectServer = function () {
	this.lights = [];
}

HueEffectServer.prototype.addLight = function(light) {
   this.lights.push(light);
}

HueEffectServer.prototype.stopScene = function() {
   this.interrupt = true;
   clearTimeout(this.timer);
}

HueEffectServer.prototype.runScene = function(sceneName) {
   	try {
	   	this.stopScene();
		this.interrupt = false;
		var sceneFile = __dirname +"/scenes/"+sceneName + ".json";
		logger.info("try to load scene : %s",sceneFile);
    	var buffer = fs.readFileSync(sceneFile);
    	var scene_settings = JSON.parse(buffer.toString());
    	if (scene_settings) {
    	  logger.debug(JSON.stringify(scene_settings));
    	  
    	  if ((scene_settings) && (scene_settings.mode)){
	    	  var mode = scene_settings.mode;
	    	  var frames = scene_settings.frames;
	    	  if (mode=="static") {
		    	  this.runStaticScene(frames[0]);
	    	  }
	    	  
	    	  if (mode=="fx") {
		    	  this.runFXScene(scene_settings.loop,frames,0);
	    	  }

    	  }
    	}
	} catch (e) {
		logger.warn("Error while reading scene", e);
	}
}


HueEffectServer.prototype.getArgument = function(input) {
	if (typeof input === 'number') {
	   return input;
	} else {
       input = Math.random() * (input[1] - input[0]) + input[0];	
	   return input;
   	}
}

HueEffectServer.prototype.hs360 = function(input,max,base) {
   
   input = this.getArgument(input);
   
   var percent = (base/input);
   var result = (max/percent);
   return result;
}

HueEffectServer.prototype.runStaticScene = function(frame) {
    // We only have one Frame	
    var hue = this.hs360(frame.hue,65535,360);
    var bri = this.hs360(frame.brightness,254,100);
    var sat = this.hs360(frame.saturation,254,100);
    var transition = this.getArgument(frame.transition) || 5;
    
    var lightstate = {"transitiontime":transition,"bri":bri,"sat":sat,"hue":hue,"on":true};

    this.lights.forEach(function (light) {
	    light.setLightData(lightstate);
    });
}

HueEffectServer.prototype.runFXScene = function(loop,frames,curFrame) {
    var that = this;
    
    if (this.interrupt == true) {
	    return;
    }
    
    if ((loop==true) && (curFrame == frames.length)) {
	    curFrame = 0;
    }

    var frame = frames[curFrame];
    
    if (frame) {
	   if (frame.pause) {
		   var pause = this.getArgument(frame.pause);
		   this.timer = setTimeout(function() {
			   that.runFXScene(loop,frames,curFrame+1);
			}
			, pause*100);
			
		   return;
		} else {
			
			if ((frame.bulbs==undefined) || (frame.bulbs==0)) {
				
		    	var hue = this.hs360(frame.hue,65535,360);
				var bri = this.hs360(frame.brightness,254,100);
				var sat = this.hs360(frame.saturation,254,100);
				var transition = this.getArgument(frame.transition) || 5;
				var lightstate = {"transitiontime":transition,"bri":bri,"sat":sat,"hue":hue,"on":true};
				this.lights.forEach(function (light) {
	    			light.setLightData(lightstate);
    			});
    			
			} else {
				
				this.lights.forEach(function (light) {
					var hue = that.hs360(frame.hue,65535,360);
					var bri = that.hs360(frame.brightness,254,100);
					var sat = that.hs360(frame.saturation,254,100);
					var transition = that.getArgument(frame.transition) || 5;
					var lightstate = {"transitiontime":transition,"bri":bri,"sat":sat,"hue":hue,"on":true};
	    			light.setLightData(lightstate);
    			});

			}
			
			
			this.timer = setTimeout(function() {
			   that.runFXScene(loop,frames,curFrame+1);
			}
			, 0);
			
			return;
		}
    }
}

module.exports = {
  HueEffectServer : HueEffectServer
}