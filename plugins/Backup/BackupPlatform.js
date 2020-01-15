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
var scheduler = require('node-schedule')
var http = require('http')
var RegaRequest = require(appRoot + '/HomematicReqaRequest.js')

function BackupPlatform(plugin, name, server, log, instance) {
    BackupPlatform.super_.apply(this, arguments)
    HomematicDevice = server.homematicDevice
}

util.inherits(BackupPlatform, HomematicVirtualPlatform)


BackupPlatform.prototype.init = function() {
    let that = this
    this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
    this.log.info('Init %s', this.name)
    this.cron = this.configuration.getValueForPlugin(this.name, "cron", 0);
    this.token = this.configuration.getValueForPlugin(this.name, "token", "");
    this.dropboxFolder = this.configuration.getValueForPlugin(this.name, "folder", "");
    this.schedule()
}

BackupPlatform.prototype.shutdown = function() {
    this.log.debug('Backup Plugin Shutdown')
    Object.keys(scheduler.scheduledJobs).forEach(function(job) {
        scheduler.cancelJob(job)
    })
}

BackupPlatform.prototype.schedule = function() {
    let that = this
    if ((this.cron != "") && (this.token != "")) {

        let job = scheduler.scheduleJob("[BACKUP]", this.cron, function() {

        })

        job.callback = function() {
            that.createBackup()
        }

        this.log.info(JSON.stringify(job))
        this.log.info(JSON.stringify(job.nextInvocation()))
    }
}

BackupPlatform.prototype.createBackup = function() {
    // First create a CCU Backup
    let that = this
    let script = "string stdout;  string stderr;system.Exec(\"sh -c 'rm /usr/local/etc/config/addons/www/hvl_backup.sbk;rm -rf /usr/local/tmp/hvl_tmp/;mkdir -p /usr/local/tmp/hvl_tmp;tar --exclude=usr/local/tmp --exclude=usr/local/lost+found -czf /usr/local/tmp/hvl_tmp/usr_local.tar.gz /usr/local;cd /usr/local/tmp/hvl_tmp/;cp /boot/VERSION firmware_version;crypttool -s -t 1 <usr_local.tar.gz >signature;crypttool -g -t 1 >key_index;tar -cf /usr/local/tmp/last_backup.sbk usr_local.tar.gz signature firmware_version key_index;mv /usr/local/tmp/last_backup.sbk /usr/local/etc/config/addons/www/hvl_backup.sbk;rm -rf /usr/local/tmp/hvl_tmp/;'\",&stdout, &stderr);"
    this.log.info('Creating CCU Backup')
    new RegaRequest(this.hm_layer, script, function() {
        // Download this backup
        that.log.info('CCU Backup done. Saving to local config folder')
        let file = fs.createWriteStream(path.join(that.configuration.storagePath(), 'ccu_backup.sbk'));
        const request = http.get('http://' + that.hm_layer.ccuIP + '/addons/hvl_backup.sbk', function(response) {
            response.pipe(file);
            // Wait 10 seconds and than create a HVL backup
            setTimeout(function() {
                that.createHVLBackup()
            }, 10000)
        });
    })
}

BackupPlatform.prototype.createHVLBackup = function() {
    let that = this
    let backupfile = path.join('/tmp', 'hvl_backup.tar.gz')
    if (fs.existsSync(backupfile)) {
        fs.unlinkSync(backupfile)
    }
    this.server.createHVLBackup()
        // Upload to Dropbox
    var lastID = this.configuration.getValueForPlugin(this.name, "lastid", 0);
    var maxID = this.configuration.getValueForPlugin(this.name, "maxbackups", 10);
    if (isNaN(lastID)) {
        lastID = 0
    }
    var id = lastID + 1
    if (id > maxID) {
        id = 0
    }
    this.log.info("HVL Backup done ...")
    if (this.token != "") {
        const dropboxV2Api = require('dropbox-v2-api');

        const dropbox = dropboxV2Api.authenticate({
            token: that.token
        })
        dropbox({
            resource: 'files/upload',
            parameters: {
                path: '/' + that.dropboxFolder + '/hvl_backup.tar_' + (id || 0) + '.gz',
                mode: 'overwrite'
            },
            readStream: fs.createReadStream(backupfile)
        }, (err, result, response) => {
            if (err === null) {
                that.log.info('Dropbox finished')
                that.configuration.setValueForPlugin(that.name, "lastid", id)
            } else {
                that.log.error('Dropbox finished with error %s', JSON.stringify(err))
            }
            fs.unlinkSync(backupfile)
        })
    } else {
        this.log.info('Missing Dropbox Token. Skip Upload')
    }
}

BackupPlatform.prototype.showSettings = function(dispatched_request) {
    var cron = this.configuration.getValueForPlugin(this.name, "cron", "");
    var token = this.configuration.getValueForPlugin(this.name, "token", "");
    var folder = this.configuration.getValueForPlugin(this.name, "folder", "");
    var maxbackups = this.configuration.getValueForPlugin(this.name, "maxbackups", 10);
    var result = [];
    result.push({
        "control": "text",
        "name": "cron",
        "label": "Cron Setting",
        "value": cron,
        "description": "The cron string to schedule autobackup"
    })

    result.push({
        "control": "text",
        "name": "token",
        "label": "Token",
        "value": token,
        "description": "The Dropbox Api token"
    })

    result.push({
        "control": "text",
        "name": "folder",
        "label": "Dropbox Folder",
        "value": folder,
        "description": "The Dropbox Folder to put the backup"
    })

    result.push({
        "control": "text",
        "name": "maxbackups",
        "label": "Max number of backups",
        "value": maxbackups,
        "description": "The number of backups to keep at max"
    });
    return result;
}

BackupPlatform.prototype.saveSettings = function(settings) {
    var cron = settings.cron
    var token = settings.token
    var folder = settings.folder
    var maxbackups = settings.maxbackups

    if (cron) {
        this.cron = cron
        this.configuration.setValueForPlugin(this.name, "cron", cron)
    } else {
        this.log.warn("SaveSettings no ip in %s", JSON.stringify(settings))
    }

    if (token) {
        this.token = token;
        this.configuration.setValueForPlugin(this.name, "token", token)
    } else {
        this.log.warn("SaveSettings no token in %s", JSON.stringify(settings))
    }

    if (folder) {
        this.dropboxFolder = folder;
        this.configuration.setValueForPlugin(this.name, "folder", folder)
    } else {
        this.log.warn("SaveSettings no folder in %s", JSON.stringify(settings))
    }

    if (maxbackups) {
        this.configuration.setValueForPlugin(this.name, "maxbackups", maxbackups)
    } else {
        this.log.warn("SaveSettings no maxbackups in %s", JSON.stringify(settings))
    }


    this.schedule()
}

BackupPlatform.prototype.handleConfigurationRequest = function(dispatchedRequest) {
    var template = 'index.html'
    let that = this
    var requesturl = dispatchedRequest.request.url
    var queryObject = url.parse(requesturl, true).query
    var deviceList = ''

    if (queryObject['do'] !== undefined) {
        switch (queryObject['do']) {
            case 'app.js':
                {
                    template = 'app.js'
                }
                break
            case 'backup':
                {
                    setTimeout(function() {
                        that.createBackup()
                    }, 1000)

                }
                break
        }
    }

    dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {
        'listDevices': deviceList
    })
}


module.exports = BackupPlatform