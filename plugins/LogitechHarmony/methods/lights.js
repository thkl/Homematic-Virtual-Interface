//
//  Lights.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 08.12.16.
//  Copyright � 2016 kSquare.de. All rights reserved.
//


"use strict";

const util = require('util');

var Service_Lights = function(server, dispatched_request) {
    this.name = 'lights'
    this.server = server;
    this.log = server.log;
    this.dispatched_request = dispatched_request;
}


Service_Lights.prototype.process = function() {
    var that = this;
    // PUT -> SET NEW STATE
    if (this.dispatched_request.method == "PUT") {
        if (this.dispatched_request.queryComponents.length > 4) {
            var lid = this.dispatched_request.queryComponents[4];
            var operation = this.dispatched_request.queryComponents[5];
            if (operation == "state") {

                this.dispatched_request.processPost(function() {
                    that.setLightState(lid);
                });

            } else {
                this.dispatched_request.sendResponse([]);
            }
        } else {
            this.server.error(this.dispatched_request, 4, this.name + "/", "method, PUT, not available for resource, /lights");
        }

        return;
    }

    // GET -> LIST
    if (this.dispatched_request.method == "GET") {
        this.log.debug('getLights Method')
        if (this.dispatched_request.queryComponents.length > 4) {
            this.log.debug('LightID (%s)', lid)
            var lid = this.dispatched_request.queryComponents[4];
            this.sendLightState(lid);
        } else {
            this.log.debug('Return all')
            this.sendLightState(undefined);
        }

        return;
    }

    this.server.error(this.dispatched_request, 4, this.name + "/", "method, " + this.dispatched_request.method + ", not available for resource, /lights");
}

Service_Lights.prototype.setLightState = function(lightId) {
    var that = this;
    var ro = [];
    var light = this.server.getLight(lightId);
    if (light != undefined) {
        var data = Object.keys(this.dispatched_request.request.post);
        if (data.length > 0) {
            var newStates = JSON.parse(data[0]);
            var newStateKeys = Object.keys(newStates);
            if (light.fake === false) {
                // Send thrue the real api
                light.sendStates(newStates);
            } else {
                newStateKeys.forEach(function(stateKey) {
                    var value = newStates[stateKey];
                    var status = {};

                    if (stateKey === "on") {
                        light.setOn(value);
                        status["/lights/" + lightId + "/state/" + stateKey] = light.isOn();
                    } else


                    if (stateKey === "bri") {
                        light.setBrightness(value);
                        status["/lights/" + lightId + "/state/" + stateKey] = light.brightness();
                    } else


                    if (stateKey === "xy") {
                        light.setXY(value)
                        status["/lights/" + lightId + "/state/" + stateKey] = light.xy();
                    } else


                    if (stateKey === "ct") {
                        light.setBrightness(value)
                        status["/lights/" + lightId + "/state/" + stateKey] = light.setBrightness();
                    } else


                    {
                        that.log.warn('unknow state key %s (%s)', stateKey, value)
                        status["/lights/" + lightId + "/state/" + stateKey] = value;

                    }

                    ro.push({
                        "success": status
                    });
                });
            }
        }

    }


    this.dispatched_request.sendResponse(ro);
}

Service_Lights.prototype._sendallLightStates = function(lights) {
    var that = this
    var ro = {}
    this.log.debug('processing %s lights', lights.length)

    async function asyncForEach(array, callback) {
        for (let index = 0; index < array.length; index++) {
            await callback(array[index], index, array);
        }
    }

    const fetch = async() => {
        await asyncForEach(lights, async(light) => {
            let promise = new Promise((resolve, reject) => {
                light.getState(function(result) {
                    resolve(result)
                })
            })
            let result = await promise
            ro[light.getId()] = result
        })
        that.dispatched_request.sendResponse(ro)
    }
    fetch()
}

Service_Lights.prototype._sendSingleLightState = async function(light) {
    let that = this
    var ro = {}
    this.log.debug('[HueServer /lights] fetch')
    let promise = new Promise((resolve, reject) => {
        light.getState(function(result) {
            resolve(result)
        })
    })
    let result = await promise
    ro[light.getId()] = result
    this.dispatched_request.sendResponse(ro)
}

Service_Lights.prototype.sendLightState = function(lightId) {

    if ((lightId == undefined) || (lightId.length == 0)) {
        var lights = this.server.getLights();
        if (lights != undefined) {
            this._sendallLightStates(lights)
        } else {
            this.server.log.error("There are no lights")
        }
    } else {
        var light = this.server.getLight(lightId);
        if (light != undefined) {
            this._sendSingleLightState(light)
        } else {
            this.server.error(this.dispatched_request, 3, this.name + "/" + lightId, "resource, " + this.name + "/" + lightId + ", not available");
            return;
        }
    }
}

module.exports = Service_Lights