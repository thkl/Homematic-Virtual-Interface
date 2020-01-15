//
//  LogicalPlatform.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 30.11.16.
//  Copyright � 2016 kSquare.de. All rights reserved.
//
//  Scriptengine adapted from https://github.com/hobbyquaker/mqtt-scripts/

/* eslint-disable handle-callback-err */

'use strict'

var path = require('path')
var fs = require('fs')

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

appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')
var logicLogger = require(appRoot + '/logger.js').logger('LogicLogger')
    // var xmlrpc = require(appRoot + '/homematic-xmlrpc')

var _global = {}

var modules = {
    'fs': require('fs'),
    'path': require('path'),
    'vm': require('vm'),
    'domain': require('domain'),
    'node-schedule': require('node-schedule'),
    'suncalc': require('suncalc'),
    'url': require('url'),
    'promise': require('promise'),
    'http': require('http'),
    'moment': require('moment'),
    'uuidv4': require('uuid/v4'),
    'RegaRequest': require(appRoot + '/HomematicReqaRequest.js'),
    'sqlite3': require('better-sqlite3')
}

var domain = modules.domain
var vm = modules.vm
var scheduler = modules['node-schedule']
var suncalc = modules.suncalc
var url = modules.url
    // var http = modules.http
var RegaRequest = modules.RegaRequest
var Promise = modules.promise
var moment = modules.moment
var uuidv4 = modules.uuidv4
var sqlite3 = modules.sqlite3
const util = require('util')

function LogicalPlatform(plugin, name, server, log, instance) {
    LogicalPlatform.super_.apply(this, arguments)
    this.scripts = {}
    this.subscriptions = []
    this.sunEvents = []
    this.mqttEvents = []
    this.harmonyEvents = []
    this.webhookEvents = []
    this.delays = {}
    this.sunTimes = [ /* yesterday */ {}, /* today */ {}, /* tomorrow */ {}]
    this.sessionVariables = {}
    this.ccuVariables = {}
}

util.inherits(LogicalPlatform, HomematicVirtualPlatform)

LogicalPlatform.prototype.init = function() {
    var that = this
    this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
    this.log.info('Init %s', this.name)
    this.localIP = this.configuration.getIPAddress()
    this.pushurl = this.configuration.getValueForPlugin(this.name, "pushurl", "");

    logicLogger.info('Logical Bridge is starting')

    // Add myself to COre Event Notifier

    this.bridge.addRPCClient('BidCos-RF')

    this.hm_layer.addEventNotifier(function() {
            that.hm_layer.on('ccu_datapointchange_event', function(strIf, channel, datapoint, value) {
                that.log.debug('CCU Event %s %s %s %s', strIf, channel, datapoint, value)
                that.ccuEvent(strIf + '.' + channel, datapoint, value)
            })
            that.log.debug('Done adding Event Listener')
        })
        // Check Path

    var spath = path.join(this.configuration.storagePath(), 'scripts')
    var myutil = require(path.join(appRoot, 'Util.js'))
    myutil.createPathIfNotExists(spath)

    this.calculateSunTimes()

    // Load saved session variables
    var saveFile = path.join(this.configuration.storagePath(), 'logic_tmp.json')
    if (fs.existsSync(saveFile)) {
        try {
            let dta = fs.readFileSync(saveFile)
            this.sessionVariables = JSON.parse(dta)
            fs.unlinkSync(saveFile);
        } catch (err) {
            this.log.error("Error while reloading the session variables")
        }
    }

    const LocalStorage = require(path.join(__dirname, 'LocalStorage.js')).LocalStorage;
    this.localStorage = new LocalStorage(this.server, appRoot)

    const LogicUIHandler = require(path.join(__dirname, 'LogicUIHandler.js')).LogicUIHandler;
    this.uihandler = new LogicUIHandler(this)
    this.uihandler.scheduler = scheduler

    // wait until the database is populated 
    this.localStorage.on('local_storage_init_done', function() {
        that.reInitScripts()
        that.processMQTTBinding()
        that.processHarmonyBinding()
    })

    this.localStorage.init()
}

LogicalPlatform.prototype.channelName = function(datapoint) {
    // Split Datapoint into channel
    return this.localStorage.channelName(datapoint)
}

LogicalPlatform.prototype.getAddress = function(arg1, arg2, arg3) {
    return this.localStorage.getAddress(arg1, arg2, arg3)
}



LogicalPlatform.prototype.regaCommand = function(script, callback) {
    /* eslint-disable no-new */
    new RegaRequest(this.hm_layer, script, callback)
}

LogicalPlatform.prototype.reInitScripts = function() {
    var that = this
        // Kill all and Init
    this.scripts = {}
    this.subscriptions = []
    this.mqttEvents = []
    this.harmonyEvents = []
    this.webhookEvents = []
        // Kill All Scheduled Jobs

    Object.keys(scheduler.scheduledJobs).forEach(function(job) {
        that.log.info('Canceling %s', job)
        that.log.info('Result %s', scheduler.cancelJob(job))
    })

    var l_path = this.configuration.storagePath()
    this.loadScriptDir(l_path + '/scripts/')

    scheduler.scheduleJob('[Intern] Astro Calculation', '0 0 * * *', function() {
        // re-calculate every day
        that.calculateSunTimes()
            // schedule events for this day
        that.sunEvents.forEach(function(event) {
            that.sunScheduleEvent(event)
        })

        that.log.info('re-scheduled', that.sunEvents.length, 'sun events')
    })

}

LogicalPlatform.prototype.loadScriptDir = function(pathName) {
    var that = this

    fs.readdir(pathName, function(err, data) {
        if (err) {
            if (err.errno === 34) {
                that.log.error('directory %s not found', path.resolve(pathName))
            } else {
                that.log.error('readdir %s %s', pathName, err)
            }
        } else {
            data.sort().forEach(function(file) {
                if (file.match(/\.(js)$/)) {
                    that.loadScript(path.join(pathName, file))
                }
            })
        }
    })
}

LogicalPlatform.prototype.loadScript = function(filename) {
    var that = this

    if (this.scripts[filename]) {
        this.log.error('Huuuh %s already loaded?!', filename)
        return
    }

    this.log.info('loading script %s', filename)

    fs.readFile(filename, function(err, src) {
        if (err && err.code === 'ENOENT') {
            that.log.error('%s not found', filename)
        } else if (err) {
            that.log.error(filename, err)
        } else {
            if (filename.match(/\.js$/)) {
                // Javascript
                that.scripts[filename] = {}
                that.scripts[filename].file = filename
                that.scripts[filename].tags = []
                that.scripts[filename].script = that.createScript(src, filename)
            }
            if (that.scripts[filename]) {
                that.runScript(that.scripts[filename], filename)
            }
        }
    })
}

LogicalPlatform.prototype.createScript = function(source, name) {
    this.log.debug('compiling %s', name)
    try {
        if (!process.versions.node.match(/^0\.10\./)) {
            // Node.js >= 0.12, io.js
            return new vm.Script(source, {
                filename: name
            })
        } else {
            // Node.js 0.10.x
            return vm.createScript(source, name)
        }
    } catch (e) {
        this.log.error(name, e.name + ':', e.message)
        return false
    }
}

LogicalPlatform.prototype.sendValueRPC = function(interf, adress, datapoint, value, callback) {
    var that = this
    if ((this.localStorage) && (typeof value !== 'object')) {
        this.log.info('Check type %s', interf + '.' + adress + '.' + datapoint)
        if (this.localStorage.isDouble(interf + '.' + adress + '.' + datapoint)) {
            this.log.info('isdouble')
            value = {
                explicitDouble: value
            }
        }
    }
    this.bridge.callRPCMethod(interf, 'setValue', [adress, datapoint.toUpperCase(), value], function(error, value) {
        that.bridge.doCache(interf, adress, datapoint, value)
        callback()
    })
}

LogicalPlatform.prototype.internal_getState = function(interf, adress, datapoint, callback) {
    var that = this
    this.bridge.callRPCMethod(interf, 'getValue', [adress, datapoint.toUpperCase()], function(error, value) {
        that.bridge.doCache(interf, adress, datapoint, value)
        if (callback) {
            callback(value)
        }
    })
}

LogicalPlatform.prototype.get_State = function(interf, adress, datapoint, callback) {
    this.internal_getState(interf, adress, datapoint, callback)
}

LogicalPlatform.prototype.get_Value = function(interf, adress, datapoint, callback) {
    var value = this.bridge.getCachedState(interf, adress, datapoint)

    if (value) {
        callback(value)
    } else {
        this.internal_getState(interf, adress, datapoint, callback)
    }
}

LogicalPlatform.prototype.isTrue = function(toCheck) {
    var result = false
    if (toCheck === true) {
        result = true
    }
    if (toCheck === 'true') {
        result = true
    }
    if (toCheck === 1) {
        result = true
    }
    if (toCheck === '1') {
        result = true
    }
    return result
}

LogicalPlatform.prototype.set_Variable = function(name, value, callback) {
    var script = ''
    if (typeof value === 'string') {
        script = "var x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + name + "');if (x){x.State('" + value + "');}"
    } else {
        script = "var x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + name + "');if (x){x.State(" + value + ');}'
    }
    this.regaCommand(script, callback)
}

LogicalPlatform.prototype.getVariable = function(name) {
    return this.ccuVariables[name]
}

LogicalPlatform.prototype.get_Variable = function(name, callback) {
    let that = this
    var script = "var x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + name + "');if (x){Write(x.Variable());}"
    this.regaCommand(script, function(result) {
        that.ccuVariables[name] = result
        if (callback) {
            callback(result)
        }
    })
}

LogicalPlatform.prototype.get_Variables = function(variables, callback) {
    let that = this
    var script = 'object x;'
    variables.forEach(function(variable) {
        script = script + "x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + variable + "');if (x){WriteLine(x#'\t\t'#x.Variable()#'\t\t'#x.Timestamp());}"
    })

    var vr_result = {}
    this.regaCommand(script, function(result) {
        var arr = result.split('\r\n')

        arr.forEach(function(var_line) {
            var vr = var_line.split('\t\t')
            var nv = {}
            if ((vr.length > 1) && (vr[0]) && (vr[0] !== '')) {
                let vname = vr[0]
                nv.value = vr[1]
                that.ccuVariables[vname] = vr[1]
                if (vr.length > 2) {
                    nv.timestamp = moment.utc(vr[2]).valueOf()
                }
                vr_result[vr[0]] = nv
            }
        })
        callback(vr_result)
    })
}

LogicalPlatform.prototype.set_Variables = function(variables, callback) {
    var script = 'var x;'
    let that = this
    Object.keys(variables).forEach(function(key) {
        var vv = variables[key]
        if (vv !== undefined) {
            if (typeof vv === 'string') {
                script = script + "x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + key + "');if (x){x.State('" + vv + "');Write(x.State());}"
            } else {
                script = script + "x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + key + "');if (x){x.State(" + vv + ");Write(x.State());}"
            }
        } else {
            that.log.warn('unable to set %s value is undefined', key)
        }
    })
    that.log.info("Script %s", script)
    this.regaCommand(script, function(result) {
        callback()
    })

}

LogicalPlatform.prototype.executeCCUProgram = function(programName, callback) {
    var that = this
    var script = "var x=dom.GetObject('" + programName + "');if (x){x.ProgramExecute();}"
    this.regaCommand(script, function(result) {
        that.log.debug('Launched %s', programName)
        callback(result)
    })
}

LogicalPlatform.prototype.fetchMessages = function(callback) {
    var that = this
        /* eslint-disable no-useless-escape */
    var script = "boolean df = true;Write(\'{\"messages\":[\');var i=dom.GetObject(41);if(i.State()>0){var s=dom.GetObject(ID_SERVICES);string sid;foreach(sid,s.EnumIDs()){var o=dom.GetObject(sid);if (o.AlState()==asOncoming){if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\'#sid#\'\",\');Write(\'\"obj\": \"\'#o.Name()#\'\",\');var n = dom.GetObject(o.AlTriggerDP());if ((n) && (n.Channel())) {var d=dom.GetObject(n.Channel());Write(\'\"trg\":\"\'#d.Name()#\'\",\');}Write(\'\"time\":\"\'#o.Timestamp()#\'\"}\');}}}Write(\']}\');"

    this.regaCommand(script, function(result) {
        try {
            var obj = JSON.parse(result)
            callback(obj)
        } catch (e) {
            that.log.error("Fetch message error %s", e)
        }
    })
}

LogicalPlatform.prototype.confirmMessages = function(messages, callback) {
    var that = this
    var script = 'var o;'
    messages.some(function(message) {
        script = script + 'o=dom.GetObject(' + message.id + ');if(o.State()==true){o.AlReceipt();}'
    })

    this.regaCommand(script, function(result) {
        try {
            callback()
        } catch (e) {
            that.log.error("Rega Script error %s", e)
        }
    })
}

LogicalPlatform.prototype.ccuEvent = function(adress, datapoint, value) {
    this.processSubscriptions(adress, datapoint, value)
}

LogicalPlatform.prototype.wasConditionfulfilled = function(oldValue, value, condition, change) {

    if (typeof condition === 'function') {
        let check = condition(value)
        if (!check) {
            return false
        }
    }

    if (typeof condition === 'object') {
        if (condition.equals && !(condition.equals === value)) {
            return false
        }

        if (condition.gt && !(parseFloat(value) > parseFloat(condition.gt))) {
            return false
        }

        if (condition.lt && !(parseFloat(value) < parseFloat(condition.lt))) {
            return false
        }
    }

    // check if value changed
    if (change && (oldValue === value)) {
        return false
    }
    return true
}

LogicalPlatform.prototype.logicalMatch = function(sourceObject, eventObject) {
    var match = false

    if (typeof sourceObject === 'string') {
        match = (sourceObject.toLowerCase() === eventObject.toLowerCase())
    } else if (sourceObject instanceof RegExp) {
        match = eventObject.match(sourceObject)
    }
    return match
}

LogicalPlatform.prototype.processSubscriptions = function(adress, datapoint, value) {
    var that = this

    var eventSource = adress + '.' + datapoint

    this.subscriptions.forEach(function(subs) {
        var options = subs.options || {}
        var delay
        var match

        if ((typeof subs.source === 'string') || (subs.source instanceof RegExp)) {
            match = that.logicalMatch(subs.source, eventSource)
            let oldValue = subs.val
            subs.val = value
            if (!(that.wasConditionfulfilled(oldValue, value, options.condition, options.change))) {
                return
            }
        }

        if (typeof subs.callback === 'function' && match) {
            logicLogger.debug('Subscription %s was triggered %s', subs.source)
            delay = 0
            if (options.shift) delay += ((parseFloat(options.shift) || 0) * 1000)
            if (options.random) delay += ((parseFloat(options.random) || 0) * Math.random() * 1000)

            delay = Math.floor(delay)
            setTimeout(function() {
                subs.callback(subs.source, value)
            }, delay)
        }
    })
}

LogicalPlatform.prototype.logCondition = function(condition, value) {
    var check = 'unknow'
    if (condition.condition.equals) {
        check = ' equals ' + condition.condition.equals
    }
    if (condition.condition.lt) {
        check = ' less than ' + condition.condition.lt
    }
    if (condition.condition.gt) {
        check = ' greater than ' + condition.condition.gt
    }
    logicLogger.debug('Check condition %s - %s is %s', condition.source, value, check)
}

LogicalPlatform.prototype.checkConditions = function(conditionList) {
    let that = this
    var result = true
    conditionList.forEach(condition => {
        let value = that.internalGetValue(condition.source)
        that.logCondition(condition, value)
        if (!(that.wasConditionfulfilled(undefined, value, condition.condition, false))) {
            logicLogger.debug('failed')
            result = false
        } else {
            logicLogger.debug('passed')
        }
    });
    return result;
}

LogicalPlatform.prototype.getDatabase = function(name) {
    var that = this
    var spath = this.configuration.storagePath()
        // Do not store outside the config file
    try {
        var Datastore = require('nedb')
        let storeFile = path.join(spath, path.basename(name)) + '.udb'
        this.log.debug('Try to load database %s', storeFile)
        var db = new Datastore({
            filename: storeFile
        })
        db.loadDatabase(function(err) { // Callback is optional
            // Now commands will be executed
            if (err) {
                that.log.error('Error while loading custom db %s', err)
            }
        })
        return db
    } catch (e) {
        this.log.error('Error while initializing custom db %s', e)
    }
}

LogicalPlatform.prototype.calculateSunTimes = function() {
    var now = new Date()
    var today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0, 0)
    var yesterday = new Date(today.getTime() - 86400000) // (24 * 60 * 60 * 1000));
    var tomorrow = new Date(today.getTime() + 86400000) // (24 * 60 * 60 * 1000));
    var lat = this.configuration.getValueForPluginWithDefault(this.name, 'latitude', 52.520008) // Default is Berlin ;o)
    var lon = this.configuration.getValueForPluginWithDefault(this.name, 'longitude', 13.404954)

    this.sunTimes = [
        suncalc.getTimes(yesterday, lat, lon),
        suncalc.getTimes(today, lat, lon),
        suncalc.getTimes(tomorrow, lat, lon)
    ]
    this.log.info('calculatedSunTimes', this.sunTimes)
}

LogicalPlatform.prototype.sunScheduleEvent = function(obj, shift) {
    // shift = -1 -> yesterday
    // shift = 0 -> today
    // shift = 1 -> tomorrow
    var event = this.sunTimes[1 + (shift || 0)][obj.pattern]
    this.og.debug('sunScheduleEvent', obj.pattern, obj.options, shift)
    var now = new Date()

    if (event.toString() !== 'Invalid Date') {
        // Event will occur today

        if (obj.options.shift) event = new Date(event.getTime() + ((parseFloat(obj.options.shift) || 0) * 1000))

        if ((event.getDate() !== now.getDate()) && (typeof shift === 'undefined')) {
            // event shifted to previous or next day
            this.sunScheduleEvent(obj, (event < now) ? 1 : -1)
            return
        }

        if ((now.getTime() - event.getTime()) < 1000) {
            // event is less than 1s in the past or occurs later this day

            if (obj.options.random) {
                event = new Date(
                    event.getTime() +
                    (Math.floor((parseFloat(obj.options.random) || 0) * Math.random()) * 1000)
                )
            }

            if ((event.getTime() - now.getTime()) < 1000) {
                // event is less than 1s in the future or already in the past
                // (options.random may have shifted us further to the past)
                // call the callback immediately!
                obj.domain.bind(obj.callback)()
            } else {
                // schedule the event!
                scheduler.scheduleJob(event, obj.domain.bind(obj.callback))
                this.log.debug('scheduled', obj.pattern, obj.options, event)
            }
        } else {
            this.log.debug(obj.pattern, obj.options, 'is more than 1s the past', now, event)
        }
    } else {
        this.log.debug(obj.pattern, 'doesn\'t occur today')
    }
}

LogicalPlatform.prototype.triggerScript = function(script) {
    var that = this
    var found = false

    // First check if we have to run out from subscriptions

    this.subscriptions.forEach(function(subs) {
        var match = (subs.file === script)

        if (typeof subs.callback === 'function' && match) {
            that.log.debug('Found %s with a subscription - run the then part', script)
            subs.callback(null, null)
            found = true
        }
    })

    if (!found) {
        // Not found as a Subscripttion .. get the script and run manually
        var l_path = this.configuration.storagePath()
        var sfile = l_path + '/scripts/' + script
        var oscript = this.scripts[sfile]
        if (oscript) {
            // Check Callback and Run it

            this.log.debug('Not found in subscriptions - load and run %s', sfile)
            fs.readFile(sfile, function(err, src) {
                if (err && err.code === 'ENOENT') {
                    that.log.error('%s not found', sfile)
                } else if (err) {
                    that.log.error(sfile, err)
                } else {
                    if (sfile.match(/\.js$/)) {
                        // Javascript
                        var triggeredScript = that.createScript(src, sfile)
                        that.runScript(triggeredScript, sfile)
                    }
                }
            })
        }
    }
    this.log.debug('Subscriptions : ', JSON.stringify(this.subscriptions))
}

LogicalPlatform.prototype.httpCall = function(method, aUrl, parameter, callback) {
    this.log.debug('HTTP CALL : %s %s %s', method, aUrl, parameter)
    try {
        var myutil = require(path.join(appRoot, 'Util.js'))
        myutil.httpCall(method, aUrl, parameter, callback)
    } catch (err) {
        this.log.error(err.stack)
    }
}

//check all lights in a room if its on
LogicalPlatform.prototype.isRoomOn = function(room, section, excludelist, callback) {
    let that = this
        // first rega to the ccu and ask for all channels in a room
    var script = 'integer tmp2 = 0;string skip = "' + excludelist + '";string tmp1;var oSec = dom.GetObject("' + section + '"); var oRoom = dom.GetObject("' + room + '");'
    script = script + 'foreach(tmp1, oRoom.EnumUsedIDs()) {if ((skip.Contains(tmp1)) == false) {string tmp5;foreach(tmp5,oSec.EnumUsedIDs()) {if (tmp5==tmp1) {string tmp6 = "LEVEL";var tmp7 = dom.GetObject(tmp1);if (tmp7.HssType()=="SWITCH") {tmp6 = "STATE";}var tmp8 = tmp7.DPByHssDP(tmp6);if (tmp8) {if ((tmp6=="LEVEL") && (tmp8.Value()>0)){tmp2 = tmp2 + 1;}if ((tmp6=="STATE") && (tmp8.Value()==true)) {tmp2 = tmp2 + 1;}}}}}}Write("{\\"result\\":"#tmp2#"}");'
    new RegaRequest(this.hm_layer, script, function(result) {
        if (callback)  { 
            if (result) {
                let oResult = JSON.parse(result)
                if ((oResult.result) && (parseInt(oResult.result) > 0)) {
                    callback(true)
                } else {
                    callback(false)
                }
            }
        }
    })
}

LogicalPlatform.prototype.internalGetValue = function(target) {
    var tmp = target.split('.')
    if (tmp.length > 2) {
        if (this.isVirtualPlatformDevice(tmp[0])) {
            var adress = tmp[1]
            var datapointName = tmp[2]
            var channel = this.hm_layer.channelWithAdress(adress)
            if (channel) {
                return channel.getValue(datapointName)
            }
        } else {
            adress = tmp[1]
            datapointName = tmp[2]
            let result = this.bridge.getCachedState(tmp[0], adress, datapointName)
            if (result === undefined) {
                this.internal_getState(tmp[0], adress, datapointName)
            } else {
                return result
            }
        }
    } else {
        that.log.error('not enough dots')
    }
    return undefined
}

LogicalPlatform.prototype.getDpsInGroup = function(id_group, section, dpname, callback) {
    if (this.localStorage) {
        this.log.info('DB Fetch Grouptype %s name %s dpName %s', id_group, section, dpname)
        callback(this.localStorage.getDpsInGroup(id_group, section, dpname))
    } else {
        let script = 'Write(\"{\\"sources\\":[\");string cid; var secObj=dom.GetObject(' + id_group + ').Get(\"' + section + '\"); boolean df = true;foreach(cid, secObj.EnumUsedIDs()){var cObj = dom.GetObject(cid);var dpN = cObj.DPByHssDP(\"' + dpname + '\");if (dpN) {if(df) {df = false;} else {Write(\",\");}Write(\"\\"\" # dpN.Name() # \"\\"\");}}Write(\"]}\");'
        let that = this
        var resultList = []
        new RegaRequest(this.hm_layer, script, function(result) {
            try {
                let oResult = JSON.parse(result)
                if ((oResult) && (oResult.sources)) {
                    oResult.sources.forEach(sourceObject => {
                        resultList.push(sourceObject)
                    })
                }
                if (callback) {
                    callback(resultList)
                }
            } catch (err) {
                that.log.error('JSON Parsing error for %s', result)
            }
        })
    }
}

LogicalPlatform.prototype.subscribeToGroup = function(options, subscribefkt) {
    let that = this
    that.log.debug('Subscribed multiple items in group %s', options.group)
    logicLogger.info('Subscribed multiple items in group %s', options.group)
    var tmp_options = {}
    tmp_options.condition = options.condition
    tmp_options.change = (options.trigger === 'change')
        // Fetch all DPs from local datastorage
    options.dpname.split(',').forEach(dapointname => {
        let list = that.localStorage.getDpsInGroup(options.type, options.group, dapointname)
        if (list) {
            list.forEach(adr => {
                if (subscribefkt) {
                    subscribefkt(adr, tmp_options, options.callback)
                }
            })
        } else {
            that.log.warn('List is empty')
        }
    })
}


/* eslint-disable prefer-promise-reject-errors */

LogicalPlatform.prototype.runScript = function(script_object, name) {
    var script = script_object.script

    // set to filename if no name provided
    var scriptName = path.basename(name)

    var scriptDir = path.dirname(path.resolve(name))
    var that = this

    this.log.debug('creating domain %s', name)
    var scriptDomain = domain.create()

    if (script_object.timers === undefined) {
        script_object.timers = []
    }

    this.log.debug('creating sandbox %s', name)

    var Sandbox = {

        global: _global,

        setTimeout: setTimeout,
        setInterval: setInterval,
        clearTimeout: clearTimeout,
        clearInterval: clearInterval,

        Buffer: Buffer,

        clearTimers: function Sandbox_clearTimers()  {
            script_object.timers.forEach(timer => {
                clearTimeout(timer)
            })
            script_object.timers = []
        },

        wait: function Sandbox_wait(time, callback) {
            if ((time === undefined) ||  (time === 0))  {
                // if not defined use a random value between 200 and 500ms
                time = Math.floor(Math.random() * (500 - 200) + 200)
            } else {
                time = time * 1000
            }
            that.log.debug("Settings Timer to %s", time)

            let timer = setTimeout(function() {
                that.log.debug("Timer is done")

                if (callback) {
                    callback()
                }
            }, (time))

            script_object.timers.push(timer)
            return timer
        },

        require: function(md) {
            if (modules[md]) return modules[md]

            try {
                var tmp
                if (md.match(/^\.\//) || md.match(/^\.\.\//)) {
                    tmp = './' + path.relative(__dirname, path.join(scriptDir, md))
                } else {
                    tmp = md
                    if (fs.existsSync(path.join(scriptDir, 'node_modules', md, 'package.json'))) {
                        tmp = './' + path.relative(__dirname, path.join(scriptDir, 'node_modules', md))
                        tmp = path.resolve(tmp)
                    }
                }
                Sandbox.log.debug('require', tmp)
                modules[md] = require(tmp)
                return modules[md]
            } catch (e) {
                var lines = e.stack.split('\n')
                var stack = []
                for (var i = 6; i < lines.length; i++) {
                    if (lines[i].match(/runInContext/)) break
                    stack.push(lines[i])
                }
                that.log.error(scriptName + ': ' + e.message + '\n' + stack)
            }
        },

        log: {
            /**
             * Log a debug message
             * @memberof log
             * @method debug
             * @param {...*}
             */
            debug: function() {
                var args = Array.prototype.slice.call(arguments)
                var rep = args.slice(1, args.length)
                var i = 0
                var output = args[0]
                if ((typeof args[0]) === 'string') {
                    output = args[0].replace(/%s/g, function(match, idx) {
                        var subst = rep.slice(i, ++i).toString()
                        return (subst)
                    })
                }
                logicLogger.debug('[Script:' + scriptName + ']:' + output)
            },
            /**
             * Log an info message
             * @memberof log
             * @method info
             * @param {...*}
             */
            info: function() {
                var args = Array.prototype.slice.call(arguments)
                var rep = args.slice(1, args.length)
                var i = 0
                var output = args[0]
                if ((typeof args[0]) === 'string') {
                    output = args[0].replace(/%s/g, function(match, idx) {
                        var subst = rep.slice(i, ++i).toString()
                        return (subst)
                    })
                }

                logicLogger.info('[Script:' + scriptName + ']:' + output)
            },
            /**
             * Log a warning message
             * @memberof log
             * @method warn
             * @param {...*}
             */
            warn: function() {
                var args = Array.prototype.slice.call(arguments)
                var rep = args.slice(1, args.length)
                var i = 0
                var output = args[0]
                if ((typeof args[0]) === 'string') {
                    output = args[0].replace(/%s/g, function(match, idx) {
                        var subst = rep.slice(i, ++i).toString()
                        return (subst)
                    })
                }
                logicLogger.warn('[Script:' + scriptName + ']:' + output)
            },
            /**
             * Log an error message
             * @memberof log
             * @method error
             * @param {...*}
             */
            error: function() {
                var args = Array.prototype.slice.call(arguments)
                var rep = args.slice(1, args.length)
                var i = 0
                var output = args[0]
                if ((typeof args[0]) === 'string') {
                    output = args[0].replace(/%s/g, function(match, idx) {
                        var subst = rep.slice(i, ++i).toString()
                        return (subst)
                    })
                }
                logicLogger.error('[Script:' + scriptName + ']:' + output)
            }
        },

        isTrue: function Sandbox_isTrue(toCheck) {
            return that.isTrue(toCheck)
        },

        getDataPointsInSection: function Sandbox_getDataPointsInSection(section, dpname) {
            return new Promise(function(resolve, reject) {
                try {

                    that.getDpsInGroup('ID_FUNCTIONS', section, dpname, function(list) {
                        resolve(list)
                    })
                } catch (err) {
                    that.log.debug(err)
                    reject(err)
                }
            })
        },

        getDataPointsInRoom: function Sandbox_getDataPointsInRoom(room, dpname) {
            return new Promise(function(resolve, reject) {
                try {
                    that.getDpsInGroup('ID_ROOMS', room, dpname, function(list) {
                        resolve(list)
                    })
                } catch (err) {
                    that.log.debug(err)
                    reject(err)
                }
            })
        },

        getChannelName: function Sandbox_channelName(datapoint) {
            return that.channelName(datapoint)
        },

        getAddress: function Sandbox_address(device, channel, datapoint) {
            return that.getAddress(device, channel, datapoint)
        },

        link: function Sandbox_link(source, target, /* optional */ value, offset) {
            Sandbox.subscribe(source, function(source, val) {
                val = (typeof value === 'undefined') ? val : value
                that.log.debug('logic-link', source, target, val)
                if (typeof offset === 'undefined') {
                    Sandbox.setValue(target, val)
                } else {
                    Sandbox.setValue(target, val + offset)
                }
            })
        },

        linkLightSwitch: function linkLightSwitch(source, target, options, /* optional */ callback) {
            options = arguments[2] || {}
            let a4 = arguments[3]
            if ((a4 !== '') && (a4 !== undefined)) {
                if (typeof arguments[3] !== 'function') throw new Error('callback is not a function')
                options = arguments[2] || {}
                callback = arguments[3]
            }

            var fn = path.basename(name)

            that.subscriptions.push({
                file: fn,
                source: source,
                options: options,
                callback: scriptDomain.bind(function() {
                    var mode = 'toggle'

                    if (options !== undefined) {
                        mode = options['mode'] || 'toggle'
                    }

                    logicLogger.info('Processing lightlink %s with %s', source, target)
                    var isOn = false
                    var tmp = target.split('.')
                    if (tmp.length < 2) {
                        return
                    }
                    // first get the current taget Level
                    if (tmp[2] === 'LEVEL') {
                        Sandbox.getValue(target).then(function(value) {
                            logicLogger.debug('target %s is currently %s', target, value)
                            let ivalue = parseInt(value)
                            let dirTarget = tmp[0] + '.' + tmp[1] + '.DIRECTION'
                            Sandbox.getValue(dirTarget).then(function(dirvalue) {
                                logicLogger.debug('direction %s is currently %s ; mode is %s', target, dirvalue, mode)
                                var tvalue = 0
                                switch (mode) {
                                    case 'level_both':
                                        if (ivalue === 0) {
                                            dirvalue = 1
                                        } else if (ivalue === 1) {
                                            dirvalue = 0
                                        }
                                        ivalue = ivalue - (dirvalue === 1) ? 0.1 : -0.1
                                        break

                                    case 'level_up':
                                        if (ivalue < 1) {
                                            dirvalue = 1
                                            ivalue = ivalue + 0.1
                                            isOn = true
                                        } else {
                                            dirvalue = 0
                                        }

                                        break

                                    case 'level_down':
                                        if (ivalue > 0) {
                                            ivalue = ivalue - 0.1
                                            dirvalue = 0
                                            isOn = true
                                        } else {
                                            dirvalue = 1
                                            isOn = false
                                        }

                                        break

                                    case 'toggle':
                                        if (ivalue > 0) {
                                            tvalue = 0
                                        }
                                        if (ivalue === 0) {
                                            tvalue = 1
                                            isOn = true
                                        }

                                        break

                                    default:
                                        if (ivalue > 0) {
                                            tvalue = 0
                                        }
                                        if (ivalue === 0) {
                                            tvalue = 1
                                            isOn = true
                                        }

                                        break
                                }

                                logicLogger.info('set %s to %s', target, JSON.stringify(tvalue))
                                Sandbox.setValue(dirTarget, dirvalue)
                                Sandbox.setValue(target, tvalue).then(function() {
                                    if ((options !== undefined) && (isOn === true)) {
                                        Object.keys(options).forEach(function(ok) {
                                            if ((ok.toLocaleString() === 'mode') && (options[ok])) {
                                                logicLogger.info('set %s to %s', ok, options[ok])
                                                Sandbox.setValue(ok, options[ok])
                                            }
                                        })
                                    }

                                    if (callback !== undefined) {
                                        callback()
                                    }
                                })
                            })
                        })
                    }

                    if (target.indexOf('STATE') > -1) {
                        logicLogger.info('target %s is binary', target)
                        Sandbox.getValue(target).then(function(value) {
                            var tvalue = 0
                            if (value === 0) {
                                tvalue = 1
                                isOn = true
                            }
                            if (value === 1) {
                                tvalue = 0
                            }
                            if (value === true) {
                                tvalue = false
                            }
                            if (value === false) {
                                tvalue = true
                                isOn = true
                            }
                            Sandbox.setValue(target, tvalue).then(function() {
                                if ((options !== undefined) && (isOn === true)) {
                                    Object.keys(options).forEach(function(ok) {
                                        if ((ok.toLocaleString() === 'mode') && (options[ok])) {
                                            logicLogger.info('set %s to %s', ok, options[ok])
                                            Sandbox.setValue(ok, options[ok])
                                        }
                                    })
                                }
                                if (callback !== undefined) {
                                    callback()
                                }
                            })
                        })
                    }
                })
            })
        },

        subscribe: function Sandbox_subscribe(source, /* optional */ options, callback) {
            if (typeof source === 'undefined') {
                throw (new Error('argument source missing'))
            }

            if (arguments.length === 2) {
                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function')

                callback = arguments[1]
                options = {}
            } else if (arguments.length === 3) {
                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function')
                options = arguments[1] || {}
                callback = arguments[2]
            } else if (arguments.length > 3) {
                throw (new Error('wrong number of arguments'))
            }

            if (typeof source === 'string') {


                var tmp = source.split('.')
                that.log.debug('Single Subscription: %s', tmp.length)
                logicLogger.info('Single Subscription: %s', tmp[1])
                    // Check first Value for hmvirtual
                if (tmp.length > 2) {
                    if (tmp[0].toLowerCase() === 'mqtt') {
                        that.log.info('MQTT Subscription %s', tmp[1])
                        that.mqttEvents.push(tmp[1])
                        that.hm_layer.emit('mqtt_add_topic', tmp[1])
                    } else

                    if (tmp[0].toLowerCase() === 'harmony') {
                        that.log.info('Harmony Subscription %s', tmp[1])
                        that.harmonyEvents.push(tmp[1])
                    } else

                    if (tmp[0].toLowerCase() === 'webhook') {
                        that.log.info('WebHook Subscription %s', tmp[1])
                        that.webhookEvents.push(tmp[1])
                    } else

                    if (that.isVirtualPlatformDevice(tmp[0])) {
                        var channel = tmp[1]
                            // Bind to channel change events
                        that.processLogicalBinding(channel)
                    } else

                    {

                        if (!that.hm_layer.isCCUDatapoint(source)) {
                            source = that.fetchCCUDatapointStructure(source)
                            if (source === undefined) {
                                that.log.error('Cannot parse target %s', source)
                                return
                            }
                        }
                        tmp = source.split('.')
                        if (!that.isVirtualPlatformDevice(tmp[0])) {
                            that.proccessCCUBinding(tmp[0], tmp[1])
                        }
                    }


                }

                var fn = path.basename(name)
                that.subscriptions.push({
                    file: fn,
                    source: source,
                    options: options,
                    callback: (typeof callback === 'function') && scriptDomain.bind(callback)
                })
            } else if (typeof source === 'object' && source.length) {
                // in this case the elements should be like {source:'datapoint',condition:'condition',trigger:'change|update'}
                source.forEach(function(item) {

                    if (item.source) {
                        that.log.debug('Subscribed multiple items in %s', item.source)
                        logicLogger.info('Subscribed multiple items in %s', item.source)
                        var options = {}
                        options.condition = item.condition
                        options.change = (item.trigger === 'change')
                        Sandbox.subscribe(item.source, options, callback)
                    }

                    if (item.room) {
                        that.subscribeToGroup({
                            type: 'ID_ROOMS',
                            group: item.room,
                            condition: item.condition,
                            trigger: item.trigger,
                            callback: callback,
                            dpname: item.dpname
                        }, Sandbox.subscribe)
                    }

                    if (item.section) {
                        that.subscribeToGroup({
                            type: 'ID_FUNCTIONS',
                            group: item.section,
                            condition: item.condition,
                            trigger: item.trigger,
                            callback: callback,
                            dpname: item.dpname
                        }, Sandbox.subscribe)
                    }

                })
            }
        },

        checkConditions: function Sandbox_checkConditions(conditions) {
            return that.checkConditions(conditions)
        },

        isRoomOn: function Sandbox_isRoomOn(room, section, exclude) {
            return new Promise(function(resolve, reject) {
                that.isRoomOn(room, section, exclude, function(result) {
                    resolve(result)
                })
            })
        },

        setVariable: function Sandbox_setVariable(varname, val) {
            return new Promise(function(resolve, reject) {
                that.set_Variable(varname, val, function() {
                    resolve(val)
                })
            })
        },

        setVariables: function Sandbox_setVariables(variables) {
            return new Promise(function(resolve, reject) {
                try {
                    that.set_Variables(variables, function() {
                        resolve(variables)
                    })
                } catch (err) {
                    that.log.debug(err)
                    reject(err)
                }
            })
        },

        getVariable: function Sandbox_getVariable(varname) {
            return new Promise(function(resolve, reject) {
                that.get_Variable(varname, function(value) {
                    resolve(value)
                })
            })
        },

        getVariableValue: function Sandbox_getCachedVariableValue(varname) {
            return that.getVariable(varname);
        },

        fetchMessages: function Sandbox_fetchMessages() {
            return new Promise(function(resolve, reject) {
                that.fetchMessages(function(value) {
                    resolve(value)
                })
            })
        },

        confirmMessages: function Sandbox_confirmMessages(messages) {
            return new Promise(function(resolve, reject) {
                that.confirmMessages(messages, function(value) {
                    resolve(value)
                })
            })
        },

        getDatabase: function Sandbox_getDatabase(name) {
            return that.getDatabase(name)
        },

        getVariables: function Sandbox_get_Variables(varnames) {
            return new Promise(function(resolve, reject) {
                that.get_Variables(varnames, function(values) {
                    resolve(values)
                })
            })
        },

        setName: function Sandbox_setName(nameOfScript) {
            script_object.name = nameOfScript
            scriptName = nameOfScript
        },

        setDescription: function Sandbox_setDescription(description) {
            script_object.description = description
        },

        addTag: function Sandbox_addTag(tagName) {
            if (script_object.tags === undefined) {
                script_object.tags = []
            }
            if (script_object.tags.indexOf(tagName) === -1) {
                script_object.tags.push(tagName)
            }
        },

        regaCommand: function Sandbox_regaCommand(command, /* optional */ delay) {
            return new Promise(function(resolve, reject) {
                let delayTme = (delay !== undefined) ? parseInt(delay) : 0

                if (delayTme === 0) {
                    that.regaCommand(command, function(resp) {
                        resolve(resp)
                    })
                } else {
                    let rndTx = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
                    that.delays[rndTx] = Sandbox.setTimeout(function() {
                        Sandbox.regaCommand(command)
                    }, delayTme)
                }
            })
        },

        executeCCUProgram: function Sandbox_executeCCUProgram(programName, /* optional */ delay) {
            return new Promise(function(resolve, reject) {
                let delayTme = (delay !== undefined) ? parseInt(delay) : 0

                if (delayTme === 0) {
                    that.executeCCUProgram(programName, function(resp) {
                        resolve(resp)
                    })
                } else {
                    that.delays[programName] = Sandbox.setTimeout(function() {
                        Sandbox.executeCCUProgram(programName)
                    }, delayTme)
                }
            })
        },

        setMQTT: function Sandbox_setMQTT(topic, value, /* optional */ delay) {
            return new Promise(function(resolve, reject) {
                let mqtt_plugin = that.server.pluginWithName('MQTT')

                if (mqtt_plugin) {
                    logicLogger.info('Publish ' + value + ' to ' + topic)

                    let delayTme = (delay !== undefined) ? parseInt(delay) : 0
                    if (delayTme === 0) {
                        mqtt_plugin.platform.publish(topic, String(value))
                    } else {
                        that.delays[topic] = Sandbox.setTimeout(function() {
                            Sandbox.setMQTT(topic, value)
                        }, delayTme)
                    }
                    resolve()
                } else {
                    logicLogger.error('MQTT Plugin not found')
                    that.log.warn('No MQTT Plugin')
                    reject(undefined)
                }
            })
        },

        setValue: function Sandbox_setValue(target, val, delay) {
            return new Promise(function(resolve, reject) {
                if (typeof target === 'object' && target.length) {
                    target = Array.prototype.slice.call(target)
                    target.forEach(function(tp) {
                        Sandbox.setValue(tp, val, delay)
                        resolve(val)
                    })
                    return
                }

                let delayTme = (delay !== undefined) ? parseInt(delay) : 0
                    // Check if its a datapoint name 
                if (!that.hm_layer.isCCUDatapoint(target)) {
                    target = that.fetchCCUDatapointStructure(target)
                    if (target === undefined) {
                        that.log.error('Cannot parse target %s', target)
                        reject()
                    }
                }

                var tmp = target.split('.')
                    // First Part should be the interface
                    // Second the Adress
                    // third the Datapoint

                if (tmp.length > 2) {
                    if (that.isVirtualPlatformDevice(tmp[0])) {
                        var adress = tmp[1]
                        var datapointName = tmp[2]
                        var channel = that.hm_layer.channelWithAdress(adress)
                        if (channel) {
                            setTimeout(function() {
                                    channel.setValue(datapointName, val)
                                    channel.updateValue(datapointName, val, true)
                                }, delayTme)
                                // the resolve will not called delayed
                            resolve()
                        } else {
                            that.log.error('Channel %s not found', adress)
                        }
                    } else {
                        adress = tmp[1]
                        datapointName = tmp[2]
                        if (delayTme === 0) {
                            that.sendValueRPC(tmp[0], adress, datapointName, val, function() {
                                resolve()
                            })
                        } else {
                            that.delays[target] = Sandbox.setTimeout(function() {
                                Sandbox.setValue(target, val)
                            }, delayTme)
                        }
                    }
                } else {
                    that.log.error('Target %s seems not to be value', target)
                    reject(undefined)
                }
            })
        },

        getValue: function Sandbox_getValue(target) {
            return new Promise(function(resolve, reject) {

                    if (!that.hm_layer.isCCUDatapoint(target)) {
                        target = that.fetchCCUDatapointStructure(target)
                        if (target === undefined) {
                            that.log.error('Cannot parse target %s', target)
                            reject()
                        }
                    }


                    var tmp = target.split('.')
                        // if (typeof callback === 'function') {
                        // First Part should be the interface
                        // Second the Adress
                        // third the Datapoint
                    if (tmp.length > 2) {
                        if (that.isVirtualPlatformDevice(tmp[0])) {
                            that.log.debug('%s is virtual', target)
                            var adress = tmp[1]
                            var datapointName = tmp[2]
                            var channel = that.hm_layer.channelWithAdress(adress)
                            if (channel) {
                                resolve(channel.getValue(datapointName))
                            } else {
                                that.log.error('Channel not found %s', adress)
                            }
                        } else {
                            adress = tmp[1]
                            datapointName = tmp[2]
                            that.get_Value(tmp[0], adress, datapointName, function(value) {
                                resolve(value)
                            })
                        }
                    } else {
                        that.log.error('Target %s seems not to be value', target)
                        reject(undefined)
                    }
                })
                // }
        },

        getState: function Sandbox_getState(target, callback) {
            return new Promise(function(resolve, reject) {
                var tmp = target.split('.')
                    // First Part should be the interface
                    // Second the Adress
                    // third the Datapoint
                if (tmp.length > 2) {
                    if (that.isVirtualPlatformDevice(tmp[0])) {
                        that.log.debug('%s is virtual', target)
                        var adress = tmp[1]
                        var datapointName = tmp[2]
                        var channel = that.hm_layer.channelWithAdress(adress)
                        if (channel) {
                            resolve(channel.getValue(datapointName))
                        } else {
                            that.log.error('Channel not found %s', adress)
                        }
                    } else {
                        adress = tmp[1]
                        datapointName = tmp[2]
                        that.get_State(tmp[0], adress, datapointName, function(value) {
                            resolve(value)
                        })
                    }
                } else {
                    that.log.error('Target %s seems not to be value', target)
                    reject(undefined)
                }
            })
        },

        httpCall: function Sandbox_httpCall(method, url, parameter) {
            if (arguments.length === 2) {
                parameter = {}
            }

            return new Promise(function(resolve, reject) {
                that.httpCall(method, url, parameter, function(result, error) {
                    resolve(result, error)
                })
            })
        },

        schedule: function Sandbox_schedule(pattern, /* optional */ options, callback) {
            if (arguments.length === 2) {
                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function')
                callback = arguments[1]
                options = {}
            } else if (arguments.length === 3) {
                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function')
                options = arguments[1] || {}
                callback = arguments[2]
            } else {
                throw (new Error('wrong number of arguments'))
            }

            if (typeof pattern === 'object' && pattern.length) {
                pattern.forEach(function(pt) {
                    Sandbox.schedule(pt, options, callback)
                })
                return
            }

            that.log.debug('schedule()', pattern, options, typeof callback)
            if (options.name === undefined) {
                options.name = 'JOB:314'
            }
            if (options.random) {
                scheduler.scheduleJob(options.name, pattern, function() {
                    setTimeout(scriptDomain.bind(callback), (parseFloat(options.random) || 0) * 1000 * Math.random())
                })
            } else {
                scheduler.scheduleJob(options.name, pattern, scriptDomain.bind(callback))
            }
        },

        getSunset: function Sandbox_getSunset() {
            return moment(that.sunTimes[1].sunset).unix()
        },

        getSunrise: function Sandbox_getSunrise() {
            return moment(that.sunTimes[1].sunrise).unix()
        },

        isDay: function Sandbox_isDay(utc) {
            return moment.utc().isBetween(moment(that.sunTimes[1].sunrise), moment(that.sunTimes[1].sunset))
        },

        isNight: function Sandbox_isNight(offset = 0) {
            let milOffset = offset
            moment.locale('de')
            var sunIndex = 0
                // Check the suntimes to choose .. if the current time is behind noon use the next day
            if (moment().isAfter({
                    hour: 12,
                    minute: 0,
                    second: 0
                })) {
                sunIndex = 1
            }

            var sset = moment(that.sunTimes[sunIndex].sunset)
            var sris = moment(that.sunTimes[sunIndex + 1].sunrise)
            that.log.info("SunSet is %s", sset.format('DD.MM.YYYY HH:mm:ss'))
            that.log.info("SunRise is %s", sris.format('DD.MM.YYYY HH:mm:ss'))
            if (milOffset > 0) {
                sset.subtract(offset, 'seconds')
                sris.add(offset, 'seconds')
            }
            that.log.info("is Night check offset %s", offset)
            that.log.info("SunSet offsettet is %s", sset.format('DD.MM.YYYY HH:mm:ss'))
            that.log.info("SunRise offsettet is %s", sris.format('DD.MM.YYYY HH:mm:ss'))

            let result = moment().isBetween(sset, sris)
            that.log.info("Current %s", moment().format('DD.MM.YYYY HH:mm:ss'))
            that.log.info("Result %s", result)

            return result
        },


        setSessionVariable: function Sandbox_setSessionVariable(key, value) {
            if (that.sessionVariables[name] === undefined) {
                that.sessionVariables[name] = {}
            }
            that.sessionVariables[name][key] = value
        },

        getSessionVariable: function Sandbox_getSessionVariable(key, defaultValue) {
            if (that.sessionVariables[name] === undefined) {
                that.sessionVariables[name] = {}
            }
            if (that.sessionVariables[name][key]) {
                return that.sessionVariables[name][key]
            } else {
                return defaultValue
            }
        },

        resetSessionVariable: function Sandbox_resetSessionVariable(key) {
            if (that.sessionVariables[name] === undefined) {
                that.sessionVariables[name] = {}
            }
            that.sessionVariables[name][key] = undefined
        },

        sunSchedule: function Sandbox_sunSchedule(pattern, /* optional */ options, callback) {
            if (arguments.length === 2) {
                if (typeof arguments[1] !== 'function') throw new Error('callback is not a function')
                callback = arguments[1]
                options = {}
            } else if (arguments.length === 3) {
                if (typeof arguments[2] !== 'function') throw new Error('callback is not a function')
                options = arguments[1] || {}
                callback = arguments[2]
            } else {
                throw new Error('wrong number of arguments')
            }

            if ((typeof options.shift !== 'undefined') && (options.shift < -86400 || options.shift > 86400)) {
                throw new Error('options.shift out of range')
            }

            if (typeof pattern === 'object' && pattern.length) {
                pattern.forEach(function(pt) {
                    Sandbox.sunSchedule(pt, options, callback)
                })
                return
            }

            that.log.debug('sunSchedule', pattern, options)

            var event = that.sunTimes[0][pattern]
            if (typeof event === 'undefined') throw new Error('unknown suncalc event ' + pattern)

            var obj = {
                pattern: pattern,
                options: options,
                callback: callback,
                context: Sandbox,
                domain: scriptDomain
            }

            that.sunEvents.push(obj)

            that.sunScheduleEvent(obj)
        },

        sendPush: function Sandbox_sendPush(message) {
            if (that.pushurl) {
                let url = that.pushurl.replace("{message}", message)
                that.httpCall('GET', url, undefined, function(result, error) {

                })
            } else {
                that.log.error('No Push_URL in settings.')
            }
        }

    }

    Sandbox.console = {
        log: Sandbox.log.info,
        error: Sandbox.log.error
    }

    this.log.debug('contextifying sandbox %s', name)
    var context = vm.createContext(Sandbox)

    scriptDomain.on('error', function(e) {
        if (!e.stack) {
            return
        }
        var lines = e.stack.split('\n')
        var stack = []
        for (var i = 0; i < lines.length; i++) {
            if (lines[i].match(/\[as runInContext\]/)) break
            stack.push(lines[i])
        }

        that.log.error('Script error ' + JSON.stringify(that.log) + '[' + name + ' | ' + script_object.name + ' ' + stack.join('\n') + ']')
    })

    scriptDomain.run(function() {
        that.log.debug('running %s', name)
        try {
            script.runInContext(context)
        } catch (err) {
            that.log.error('--------------------')
            that.log.error('ERROR LOADING SCRIPT %s', name)
            that.log.error(err.stack)
            that.log.error('--------------------')
        }
    })
}

LogicalPlatform.prototype.fetchCCUDatapointStructure = function(source) {
    var result = undefined
        // Format should be "name of the device:channelnum.datapoint"
    this.log.debug('%s is a read name we have to parse', source)
        // Find : and split
    let rgx = /(.*):([0-9]{1,}).(.*)/
    let arr = rgx.exec(source)
    this.log.debug("Regex : %s", JSON.stringify(arr))
    if ((arr !== undefined) && (arr !== null) && (arr.length === 4)) {
        let name = arr[1]
        let chan = arr[2]
        let dp = arr[3]
        result = this.getAddress(name, chan, dp.toUpperCase())
    } else {
        this.log.error('Unable to parse NamedDP %s', source)
    }
    return result
}

LogicalPlatform.prototype.proccessCCUBinding = function(interface_name, channel_adress) {
    this.processSubscriptions(interface_name + '.' + channel_adress, '', '')
}

LogicalPlatform.prototype.processLogicalBinding = function(source_adress) {
    var channel = this.hm_layer.channelWithAdress(source_adress)
    var that = this
    if (channel) {
        that.log.debug('uhh someone is intrested in my value changes %s', source_adress)
        logicLogger.debug('Subscribed to %s', source_adress)
        channel.removeAllListeners('logicevent_channel_value_change')

        channel.on('logicevent_channel_value_change', function(parameter) {
            parameter.parameters.forEach(function(pp) {
                that.processSubscriptions('HMVirtual.' + parameter.channel, pp.name, pp.value)
                that.processSubscriptions(that.hm_layer.getCcuInterfaceName() + '.' + parameter.channel, pp.name, pp.value)
            })
        })
    } else {
        logicLogger.error('Cannot subscribe to %s channel was not found', source_adress)
        that.log.error('channel with adress %s not found - cannot add event listener', source_adress)
    }
}

LogicalPlatform.prototype.processMQTTBinding = function() {
    var that = this
    that.log.info('Bind to MQTT Events')
    this.hm_layer.removeAllListeners('mqtt_event')
    this.hm_layer.on('mqtt_event', function(parameter) {
        that.mqttEvents.forEach(function(topic) {
            that.log.debug('mqtt_event %s %s', parameter.topic, parameter.payload)
            if (parameter.topic.indexOf(topic) !== -1) {
                that.log.debug('topic match %s %s', topic, parameter.payload)
                that.processSubscriptions('mqtt.' + parameter.topic, '', parameter.payload)
            }
        })
    })
}

LogicalPlatform.prototype.processHarmonyBinding = function() {
    var that = this
    that.log.debug('Bind to Harmony Events')
    this.hm_layer.removeAllListeners('harmony_device_value_change')
    this.hm_layer.on('harmony_device_value_change', function(parameter) {
        that.log.debug('Harmony Event %s', JSON.stringify(parameter))
        that.harmonyEvents.forEach(function(lightid) {
            if (parameter.lightid === lightid) {
                that.log.debug('lightid match %s %s %s', lightid, parameter.parameter, parameter.state)
                that.processSubscriptions('harmony.' + parameter.lightid, parameter.parameter, parameter.state)
            }
        })
    })
}

LogicalPlatform.prototype.getValue = function(adress) {
    return this.elements[adress]
}

LogicalPlatform.prototype.deleteScript = function(scriptName) {
    try {
        var l_path = this.configuration.storagePath() + '/scripts/'
        scriptName = scriptName.replace('..', '')
        var file = fs.unlink(l_path + scriptName)
        return file
    } catch (err) {
        this.log.debug(err)
        return 'File not found ' + scriptName
    }
}

LogicalPlatform.prototype.getScript = function(scriptName) {
    try {
        var l_path = this.configuration.storagePath() + '/scripts/'
        scriptName = scriptName.replace('..', '')
        var file = fs.readFileSync(l_path + scriptName, 'binary')
        return file
    } catch (err) {
        this.log.debug(err)
        return 'File not found ' + scriptName
    }
}

LogicalPlatform.prototype.isVirtualPlatformDevice = function(interfaceName) {
    return ((interfaceName.toLowerCase() === 'hmvirtual') || (interfaceName.toLowerCase() === this.bridge.getCcuInterfaceName().toLowerCase()))
}

LogicalPlatform.prototype.saveScript = function(data, filename) {
    try {
        fs.writeFileSync(filename, data)
        this.reInitScripts()
    } catch (e) {
        this.log.error('Save script error %s', e)
    }
}

LogicalPlatform.prototype.existsScript = function(filename) {
    try {
        fs.readFileSync(filename)
        return true
    } catch (e) {
        return false
    }
}

LogicalPlatform.prototype.validateScript = function(data) {
    // Save as tmp
    try {
        var name = '/tmp/hm_tmp_script.js'
        fs.writeFileSync(name, data)

        try {
            if (!process.versions.node.match(/^0\.10\./)) {
                // Node.js >= 0.12, io.js
                new vm.Script(data, {
                    filename: name
                })
                return true
            } else {
                // Node.js 0.10.x
                vm.createScript(data, name)
                return true
            }
        } catch (e) {
            return e.stack
        }
    } catch (err) {
        return 'Filesystem error'
    }
}

LogicalPlatform.prototype.showSettings = function(dispatched_request) {
    var pushurl = this.configuration.getValueForPlugin(this.name, "pushurl", "");
    var result = [];
    result.push({
        "control": "text",
        "name": "pushurl",
        "label": "URL PushService",
        "value": pushurl,
        "description": "set message to {message}"
    })

    return result;
}

LogicalPlatform.prototype.saveSettings = function(settings) {
    var pushurl = settings.pushurl

    if (pushurl) {
        this.pushurl = pushurl
        this.configuration.setValueForPlugin(this.name, "pushurl", pushurl)
    } else {
        this.log.warn("SaveSettings no pushurl in %s", JSON.stringify(settings))
    }
}

LogicalPlatform.prototype.handleWebHook = function(dispatched_request) {
    let that = this
    let requesturl = dispatched_request.request.url
    let queryObject = url.parse(requesturl, true).query
    let adr = queryObject['adr']
    let va = queryObject['va']
    if ((adr) && (va)) {
        this.log.debug('webhook event %s %s check %s subscriptions', adr, va, this.webhookEvents.length)
        this.webhookEvents.forEach(function(address) {
            that.log.debug('check webhook_event %s vs %s', adr, address)
            if (adr === address) {
                that.log.debug('address match %s %s', address, va)
                that.processSubscriptions('webhook.' + address, '', va)
            }
        })
    }
    dispatched_request.dispatchMessage('OK')
}

LogicalPlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
    this.uihandler.run(dispatched_request, appRoot)
}

module.exports = LogicalPlatform