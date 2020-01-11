'use strict'

const path = require('path')
const fs = require('fs')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) {
    appRoot = appRoot + '/../lib'
}

if (appRoot.endsWith('node_modules/daemonize2/lib')) {
    appRoot = path.join(appRoot, '..', '..', '..', 'lib')

    if (!fs.existsSync(path.join(appRoot, 'HomematicVirtualPlatform.js'))) {
        appRoot = path.join(path.dirname(require.main.filename), '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib')
    }
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
const sqlite3 = require('sqlite3')
const uuidv4 = require('uuid/v4')

function LoggingPlatform(plugin, name, server, log, instance) {
    LoggingPlatform.super_.apply(this, arguments)
    HomematicDevice = server.homematicDevice
}

util.inherits(LoggingPlatform, HomematicVirtualPlatform)


LoggingPlatform.prototype.init = function() {
    // Open Database

    let that = this
    this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
    this.log.info('Init %s', this.name)

    let dbPath = path.join(this.configuration.storagePath(), 'logging.db')
    this.db = new sqlite3.Database(dbPath, (err) => {
            if (err) {
                that.log.error('Could not connect to database', err)
            } else {
                that.log.info('Connected to database')
            }
        })
        // Check Tables
    this.db.run('CREATE TABLE IF NOT EXISTS "log" ("id" INTEGER  PRIMARY KEY AUTOINCREMENT, "ts" datetime, "if" varchar (10) ,"address" varchar(30),"datap" varchar(20),"value" varchar(128));')
    let sql = 'INSERT INTO  "log" ("ts", "if", "address", "datap", "value") VALUES (?, ?, ?, ?, ?);'
    this.bridge.addRPCClient('BidCos-RF')

    this.hm_layer.addEventNotifier(function() {
        that.hm_layer.on('ccu_datapointchange_event', function(strIf, channel, datapoint, value) {
            // Add Data
            that.db.run(sql, [new Date().toISOString(), strIf, channel, datapoint, value])
        })
        that.log.debug('Done adding Event Listener')
    })

}

module.exports = LoggingPlatform