"use strict";

var hueconf = require("node-hue-api");
const EventEmitter = require('events');
const util = require('util');

var HomematicDevice;

var HueDayLightSensor = function(plugin, hueApi, sensor, serialprefix) {


    var that = this;
    this.api = hueApi;
    this.log = plugin.log;
    this.bridge = plugin.server.getBridge();
    this.plugin = plugin;

    HomematicDevice = plugin.server.homematicDevice;

    this.sensorId = sensor["id"];

    this.config = plugin.server.configuration;
    this.log.debug("Setup new HUE Daylight Sensor %s", serialprefix + this.lightId);
    this.serial = sensor["uniqueid"];

    // Just a Dummy for Sensor Test
    EventEmitter.call(this);

}

util.inherits(HueDayLightSensor, EventEmitter);


HueDayLightSensor.prototype.refreshSensor = function() {


}


module.exports = {
    HueDayLightSensor: HueDayLightSensor
}