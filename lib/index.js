//
//  app.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

"use strict";

var Server = require(__dirname + '/Server.js').Server;
var program = require('commander');
var Plugin = require(__dirname + '/VirtualDevicePlugin.js').VirtualDevicePlugin;
var log = require(__dirname + '/Log.js')._system;
var Config = require(__dirname + '/Config.js').Config;




log.info("Homematic Virtual Interface Core");
log.info("2016 by thkl https://github.com/thkl/Homematic-Virtual-Interface");
log.info("================================================================");


 program
    .version("0.0.5")
    .option('-P, --plugin-path [path]', 'look for plugins installed at [path] as well as the default locations ([path] can also point to a single plugin)', function(p) { Plugin.addPluginPath(p); })
    .option('-D, --debug', 'turn on debug level logging', function() { require(__dirname + '/Log.js').setDebugEnabled(true) })
    .option('-C, --config [path]', 'set your own configuration path to [path]', function(path) { Config.setCustomStoragePath(path);})
    .parse(process.argv);

process.name = "HMVirtualLayer";

var server = new Server();
server.init();
 
var signals = { 'SIGINT': 2, 'SIGTERM': 15 };
  Object.keys(signals).forEach(function (signal) {
    process.on(signal, function () {
      log.info("Got %s, shutting down Homematic Virtual Interface ...", signal);

      server.shutdown();

      process.exit(128 + signals[signal]);
    });
});