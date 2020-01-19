//
//  app.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

'use strict'

const program = require('commander')
const path = require('path')

const log = require(path.join(__dirname, 'logger.js')).logger('Core')

// Check my Own Dependencies
const Installer = require(path.join(__dirname, 'Installer.js'))
var cpath

log.info('Homematic Virtual Interface Core')
log.info('2020 by thkl https://github.com/thkl/Homematic-Virtual-Interface')
log.info('running on node version %s', process.version)
log.info('================================================================')

program
    .version('0.2.72')
    .option('-P, --plugin-path [path]', 'look for plugins installed at [path] as well as the default locations ([path] can also point to a single plugin)', function(p) {
        Plugin.addPluginPath(p)
    })
    .option('-D, --debug', 'turn on debug level logging', function() {
        require(path.join(__dirname, 'logger.js')).setDebugEnabled(true)
    })
    .option('-C, --config [path]', 'set your own configuration path to [path]', function(path) {
        cpath = path
    })
    .option('-F, --filter [regex]', 'filter debug messages my [regex]', function(regx) {
        require(path.join(__dirname, 'logger.js')).setFilter(regx)
    })
    .parse(process.argv)

process.name = 'HMVirtualLayer'

const Config = require(path.join(__dirname, 'Config.js')).Config

if (cpath !== undefined) {
    Config.setCustomStoragePath(cpath)
}

require(path.join(__dirname, 'logger.js')).setFileTransport(path.join(Config.storagePath(), 'logs', 'log.db'))

var inst = new Installer(path.join(__dirname, '..', '..'), true)
inst.installDependencies()

log.info('Launching')

const Server = require(path.join(__dirname, 'Server.js')).Server
const Plugin = require(path.join(__dirname, 'VirtualDevicePlugin.js')).VirtualDevicePlugin

var server = new Server()
server.init()

process.on('uncaughtException', function(err) {
    console.log('Caught exception: ' + err.stack)
})

var signals = {
    'SIGINT': 2,
    'SIGTERM': 15
}
Object.keys(signals).forEach(function(signal) {
    process.on(signal, function() {
        log.info('Got %s, shutting down Homematic Virtual Interface ...', signal)
        server.shutdown()
        process.exit(128 + signals[signal])
    })
})