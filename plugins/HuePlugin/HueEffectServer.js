//
//  HueEffectServer.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 28.12.16.
//  Copyright � 2016 kSquare.de. All rights reserved.
//


"use strict";

var fs = require('fs');
var path = require('path');

var HueEffectServer = function(platform, name) {
    this.name = name;
    this.lights = [];
    this.platform = platform;
    this.platform.log.debug("Platform : %s Server %s", platform, name);
    this.configuration = platform.server.configuration;
}

HueEffectServer.prototype.addLight = function(light) {
    this.lights.push(light);
}


HueEffectServer.prototype.removeLight = function(light) {
    var index = this.lights.indexOf(light);
    if (index > -1) {
        this.lights.splice(index, 1);
    }
}

HueEffectServer.prototype.stopSceneWithLight = function(light) {
    if (this.isRunning == true) {
        var index = this.lights.indexOf(light);
        if (index > -1) {
            this.platform.log.debug("Stop Scene");
            this.stopScene(true);
        }
    }
}


HueEffectServer.prototype.stopScene = function(playStopFrame) {
    if (this.isRunning == true) {
        this.interrupt = true;
        clearTimeout(this.timer);
        this.isRunning = false;
        if ((this.offFrame) && (playStopFrame == true)) {
            this.platform.log.debug("Running the stop frame");
            this.runStaticScene(this.offFrame);
        }
    } else {
        this.platform.log.warn("Scene Server is not running");
        if ((this.offFrame) && (playStopFrame == true)) {
            this.platform.log.debug("Running the stop frame");
            this.runStaticScene(this.offFrame);
        }
    }
}

HueEffectServer.prototype.listScenes = function() {
    var sceneDir = __dirname + "/scenes/";
    var privateSceneDir = this.configuration.storagePath() + "scenes/";
    var that = this;
    var list = [];
    try {
        if (fs.existsSync(sceneDir)) {
            var data = fs.readdirSync(sceneDir);
            data.sort().forEach(function(file) {
                if (file.match(/\.(json)$/)) {
                    list.push(file.replace(/\.[^/.]+$/, ""));
                }
            })
        }
        if (fs.existsSync(privateSceneDir)) {
            data = fs.readdirSync(privateSceneDir);
            data.sort().forEach(function(file) {
                if (file.match(/\.(json)$/)) {
                    list.push(file.replace(/\.[^/.]+$/, ""));
                }
            });
        }
    } catch (e) {
        this.platform.log.error("Error while loading Sceneslist %s", e.stack);
    }
    return list;
}

HueEffectServer.prototype.hasLightWithId = function(lightId) {
    return (this.lights.filter(function(light) {
        return light.lightId == lightId
    }).pop() != undefined);
}


HueEffectServer.prototype.persinstentData = function() {
    var lightIDs = [];
    this.lights.forEach(function(light) {
        lightIDs.push(light.lightId);
    });
    return {
        "name": this.name,
        "lights": lightIDs
    };
}

HueEffectServer.prototype.sceneData = function(sceneName) {
    var sceneFile = __dirname + "/scenes/" + sceneName + ".json";
    this.platform.log.info("try to load scene : %s", sceneFile);
    if (fs.existsSync(sceneFile)) {
        return fs.readFileSync(sceneFile);
    }

    var privateSceneDir = this.configuration.storagePath() + "/scenes/";
    sceneFile = privateSceneDir + sceneName + ".json";
    this.platform.log.info("try to load scene : %s", sceneFile);

    if (fs.existsSync(sceneFile)) {
        return fs.readFileSync(sceneFile);
    }

    return undefined;
}


HueEffectServer.prototype.runScene = function(sceneName) {
    var that = this;
    try {
        this.stopScene(false);
        this.interrupt = false;
        this.isRunning = true;
        var buffer = this.sceneData(sceneName);
        if (buffer) {
            var scene_settings = JSON.parse(buffer.toString());
            if (scene_settings) {
                if ((scene_settings) && (scene_settings.mode)) {
                    var mode = scene_settings.mode;
                    var frames = scene_settings.frames;
                    this.offFrame = scene_settings.stopframe;
                    if (mode == "static") {
                        this.runStaticScene(frames[0]);
                    }

                    if (mode == "fx") {
                        this.runFXScene(scene_settings.loop, frames, 0);
                    }
                }
            }
        } else {
            this.platform.log.error("Scene not found %s", sceneName);
        }

    } catch (e) {
        this.platform.log.warn("Error while reading scene %s", e.stack);
    }
    // Wait 2 seconds and refresh
    setTimeout(function() {
        that.platform.refreshAll();
    }, 2000);
}


HueEffectServer.prototype.getArgument = function(input) {
    if (input) {
        if (typeof input === 'number') {
            return input;
        } else {
            input = Math.random() * (input[1] - input[0]) + input[0];
            return input;
        }
    } else {
        return input;
    }
}

HueEffectServer.prototype.hs360 = function(input, max, base) {

    input = this.getArgument(input);

    var percent = (base / input);
    var result = (max / percent);
    return result;
}

HueEffectServer.prototype.runStaticScene = function(frame) {
    // We only have one Frame	
    var that = this;

    if ((frame.bulbs == undefined) || (frame.bulbs == 0)) {

        var hue = this.hs360(frame.hue, 65535, 360);
        var bri = this.hs360(frame.brightness, 254, 100);
        var sat = this.hs360(frame.saturation, 254, 100);
        var isOn = (bri == 0) ? false : true;
        var transition = this.getArgument(frame.transition) || 5;
        var lightstate = {
            "transitiontime": transition,
            "bri": bri,
            "sat": sat,
            "hue": hue,
            "on": isOn
        };
        this.platform.log.debug(lightstate);
        this.lights.forEach(function(light) {
            light.setLightData(lightstate);
        });

    } else {

        this.lights.forEach(function(light) {
            var hue = that.hs360(frame.hue, 65535, 360);
            var bri = that.hs360(frame.brightness, 254, 100);
            var sat = that.hs360(frame.saturation, 254, 100);
            var isOn = (bri == 0) ? false : true;
            var transition = that.getArgument(frame.transition) || 5;
            var lightstate = {
                "transitiontime": transition,
                "bri": bri,
                "sat": sat,
                "hue": hue,
                "on": isOn
            };
            light.setLightData(lightstate);
        });

    }
    this.isRunning = false;
}

HueEffectServer.prototype.runFXScene = function(loop, frames, curFrame) {
    var that = this;

    if (this.interrupt == true) {
        return;
    }

    if ((loop == true) && (curFrame == frames.length)) {
        curFrame = 0;
    }

    var frame = frames[curFrame];

    if (frame) {
        if (frame.pause) {
            var pause = this.getArgument(frame.pause);
            this.timer = setTimeout(function() {
                that.runFXScene(loop, frames, curFrame + 1);
            }, pause * 10);

            return;
        } else {

            if ((frame.bulbs == undefined) || (frame.bulbs == 0)) {

                var hue = this.hs360(frame.hue, 65535, 360);
                var bri = this.hs360(frame.brightness, 254, 100);
                var sat = this.hs360(frame.saturation, 254, 100);
                var transition = this.getArgument(frame.transition) || 5;
                var isOn = (bri == 0) ? false : true;

                var lightstate = {
                    "transitiontime": transition,
                    "bri": bri,
                    "sat": sat,
                    "hue": hue,
                    "on": isOn
                };
                this.lights.forEach(function(light) {
                    light.setLightData(lightstate);
                });

            } else {
                var randomArray = this.shuffle(this.lights);
                randomArray.forEach(function(light) {
                    var hue = that.hs360(frame.hue, 65535, 360);
                    var bri = that.hs360(frame.brightness, 254, 100);
                    var sat = that.hs360(frame.saturation, 254, 100);
                    var transition = that.getArgument(frame.transition) || 5;
                    var isOn = (bri == 0) ? false : true;

                    var lightstate = {
                        "transitiontime": transition,
                        "bri": bri,
                        "sat": sat,
                        "hue": hue,
                        "on": isOn
                    };
                    light.setLightData(lightstate);
                });

            }


            this.timer = setTimeout(function() {
                that.runFXScene(loop, frames, curFrame + 1);
            }, 0);

            return;
        }
    }
}


HueEffectServer.prototype.shuffle = function(array) {
    var currentIndex = array.length,
        temporaryValue, randomIndex;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
}

module.exports = {
    HueEffectServer: HueEffectServer
}