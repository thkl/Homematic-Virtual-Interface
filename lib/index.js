//
//  app.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

"use strict";

var program = require('commander');


var log = require(__dirname + '/logger.js').logger("Core");

// Check my Own Dependencies
var Installer = require(__dirname + '/Installer.js');
var cpath = undefined;


log.info("Homematic Virtual Interface Core");
log.info("2017 by thkl https://github.com/thkl/Homematic-Virtual-Interface");
log.info("================================================================");


 program
    .version("0.0.6")
    .option('-P, --plugin-path [path]', 'look for plugins installed at [path] as well as the default locations ([path] can also point to a single plugin)', function(p) { Plugin.addPluginPath(p); })
    .option('-D, --debug', 'turn on debug level logging', function() { require(__dirname + '/logger.js').setDebugEnabled(true) })
    .option('-C, --config [path]', 'set your own configuration path to [path]', function(path) { cpath = path;})
    .parse(process.argv);

process.name = "HMVirtualLayer";


var inst = new Installer(__dirname + "/../",true);
inst.installDependencies();
log.info("Launching");

var Server = require(__dirname + '/Server.js').Server;
var Plugin = require(__dirname + '/VirtualDevicePlugin.js').VirtualDevicePlugin;
var Config = require(__dirname + '/Config.js').Config;

if (cpath!=undefined) {
	Config.setCustomStoragePath(cpath);
}

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