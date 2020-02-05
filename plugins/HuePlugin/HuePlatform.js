//
//  HuePlatform.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright � 2016 kSquare.de. All rights reserved.
//


"use strict"

const HueApi = require('node-hue-api').HueApi
const url = require('url')
const fs = require('fs')
const path = require('path')

var HueColorDevice = require(__dirname + "/HueColorDevice.js").HueColorDevice
var HueDimmableDevice = require(__dirname + "/HueDimmableDevice.js").HueDimmableDevice
var HueDeviceOsramPlug = require(__dirname + "/HueDeviceOsramPlug.js").HueDeviceOsramPlug
var HueSceneManager = require(__dirname + "/HueSceneManager.js").HueSceneManager
var HueGroupManager = require(__dirname + "/HueGroupManager.js").HueGroupManager
var HueEffectServer = require(__dirname + "/HueEffectServer.js").HueEffectServer
var HueSFXDevice = require(__dirname + "/HueSFXDevice.js").HueSFXDevice
var HueTempSensor = require(__dirname + "/HueTempSensor.js").HueTempSensor
var HueDayLightSensor = require(__dirname + "/HueDayLightSensor.js").HueDayLightSensor

var appRoot = path.dirname(require.main.filename)

if (appRoot.endsWith("bin")) {
    appRoot = appRoot + "/../lib"
}

if (appRoot.endsWith('node_modules/daemonize2/lib')) {
    appRoot = path.join(appRoot, '..', '..', '..', 'lib')
    if (!fs.existsSync(path.join(appRoot, 'HomematicVirtualPlatform.js'))) {
        appRoot = path.join(path.dirname(require.main.filename), '..', '..', '..', 'node_modules', 'homematic-virtual-interface', 'lib')
    }
}

appRoot = path.normalize(appRoot)

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require("util")
const HueV3 = require('node-hue-api').v3

function HuePlatform(plugin, name, server, log, instance) {
    HuePlatform.super_.apply(this, arguments)
    this.mappedDevices = []
    this.hue_ipAdress
    this.hue_userName
    this.hue_api
    this.lights = []
    this.groups = []
    this.sensors = []
    this.effectServers = {}
    this.sfxDevice
    this.authorized
    this.lastUpdate = undefined
    this.observer = {}
}

util.inherits(HuePlatform, HomematicVirtualPlatform)



HuePlatform.prototype.init = function() {
    var that = this
    this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
    this.localization = require(appRoot + '/Localization.js')(__dirname + "/Localizable.strings")

    // Copy new Device for Dimmers
    this.server.publishHMDevice(this.getName(), 'HM-LC-Dim1T-Pl', path.join(__dirname, 'HM-LC-Dim1T-Pl.json'), 2)

    this.log.info("Init with hue-api v3 %s", this.name)
    var ip = this.configuration.getValueForPlugin(this.name, "hue_bridge_ip")

    if ((ip != undefined) && (ip != "")) {
        this.hue_ipAdress = ip
        this.log.info("Hue Bridge Init at %s with instance %s", this.hue_ipAdress, this.instance)
        this.authorized = false

        if (this.checkUsername() == true) {
            this.authorized = true
            this.queryBridgeAndMapDevices()
        }

    } else {

        this.locateBridge(function(err) {
            if (err) throw err
            if (that.hue_ipAdress != undefined) {
                that.configuration.setValueForPlugin(that.name, "hue_bridge_ip", that.hue_ipAdress)
                that.log.debug("Saved the Philips Hue bridge ip address " + that.hue_ipAdress + " to your config to skip discovery.")
                if (that.checkUsername() == true) {
                    that.queryBridgeAndMapDevices()
                }
            } else {
                that.log.error("No bridges this did not make sense .. giving up")
            }

        })
    }
}

HuePlatform.prototype.shutdown = function() {
    this.log.info("Shutdown")
    this.hm_layer.deleteDevicesByOwner(this.name)
    this.lights = []
    this.sensors = []
    this.groups = []
    this.effectServers = {}
    clearTimeout(this.refreshTimer)
    clearTimeout(this.userTimer)
}

HuePlatform.prototype.myDevices = function() {
    // return my Devices here
    var result = []
    var that = this
    result.push({
        "id": "sep-hued",
        "name": "--------- Hue Lights ---------",
        "type": "seperator"
    })

    this.lights.forEach(function(light) {
        result.push({
            "id": light["hm_device_name"],
            "name": light["name"],
            "type": "HUELIGHT"
        })
    })

    if (this.groups.length > 0) {
        result.push({
            "id": "sep-hueg",
            "name": "--------- Hue Groups ---------",
            "type": "seperator"
        })
        this.groups.forEach(function(group) {
            result.push({
                "id": group["hm_device_name"],
                "name": group["name"],
                "type": "HUEGROUP"
            })
        })
    }

    if (this.sceneManager.getMappedScenes().length > 0) {
        result.push({
            "id": "sep-hues",
            "name": "--------- Hue Scenes ---------",
            "type": "seperator"
        })
        this.sceneManager.getMappedScenes().forEach(function(scene) {
            var encodedAction = that.name + ":" + scene.id
            result.push({
                "id": encodedAction,
                "name": scene.name,
                "type": "HUESCENE"
            })
        })
    }

    return result
}


HuePlatform.prototype.showSettings = function(dispatched_request) {
    var result = []
    var user = this.configuration.getValueForPlugin(this.name, "hue_username")
    result.push({
        "control": "text",
        "name": "hue_bridge_ip",
        "label": "Bridge-IP",
        "value": this.hue_ipAdress
    })
    result.push({
        "control": "text",
        "name": "hue_username",
        "label": "Hue User",
        "value": user
    })
    var refreshrate = this.configuration.getValueForPluginWithDefault(this.plugin.name, "refresh", 60)

    result.push({
        "control": "text",
        "name": "refresh",
        "label": "Refresh",
        "value": refreshrate || 30
    })
    return result
}

HuePlatform.prototype.saveSettings = function(settings) {
    var that = this
    var hue_bridge_ip = settings.hue_bridge_ip
    var hue_username = settings.hue_username
    if (hue_bridge_ip) {
        this.hue_ipAdress = hue_bridge_ip
        this.configuration.setValueForPlugin(this.name, "hue_bridge_ip", hue_bridge_ip)
    }

    if (hue_username) {
        this.hue_username = hue_username
        this.configuration.setValueForPlugin(this.name, "hue_username", hue_username)
    }

    if (settings.refresh) {
        this.configuration.setValueForPlugin(this.name, "refresh", settings.refresh)
    }

    clearTimeout(this.userTimer)
    clearTimeout(this.refreshTimer)
    if (that.checkUsername() == true) {
        that.queryBridgeAndMapDevices()
    }
}


HuePlatform.prototype.runScene = function(sceneID) {
    this.hue_api.activateScene(sceneID, function(err, result) {})
}

HuePlatform.prototype.locateBridge = function(callback) {
    var that = this


    that.log.debug("trying to find your Hue bridge ...")

    HueV3.discovery.nupnpSearch().then(function(results) {
        if ((results === undefined) ||  (results.length === 0)) {
            HueV3.discovery.upnpSearch(10000).then(function(results) {
                that.hue_ipAdress = results[0].ipaddress
                callback(null, null)
            })
        } else {
            that.hue_ipAdress = results[0].ipaddress
            callback(null, null)
        }
    })
}


HuePlatform.prototype.checkUsername = function() {
    var that = this
    var user = this.configuration.getValueForPlugin(this.name, "hue_username")
    if ((user == undefined) || (user == "")) {
        this.log.debug("trying to create a new user at your bridge")
        HueV3.createLocal(that.hue_ipAdress).connect().then(function(unauthenticatedApi) {
            try {
                let deviceName = that.configuration.getMacAddress().toString().replace(/:/g, '')
                unauthenticatedApi.users.createUser('HVL', deviceName).then(function(createdUser) {
                    that.authorized = true
                    that.configuration.setValueForPlugin(that.name, "hue_username", createdUser.username)
                    that.log.debug("saved your user to config.json")
                    that.hue_userName = createdUser.username
                })
            } catch (err) {
                if (err.getHueErrorType() === 101) {
                    console.error('The Link button on the bridge was not pressed. Please press the Link button and try again.')
                    that.authorized = false
                    that.userTimer = setTimeout(function() {
                        that.checkUsername()
                    }, 10000)
                } else {
                    console.error(`Unexpected Error: ${err.message}`)
                }
            }

        })

    } else  {
        that.hue_userName = user
        return true
    }
}


// Make a connection to the HUE Bridge... if there are no credentials .. try to find a bridge


HuePlatform.prototype.queryBridgeAndMapDevices = function() {
    var that = this
    new HueV3.api.createLocal(this.hue_ipAdress).connect(this.hue_userName).then(function(api) {
        that.hue_api = api

        that.sceneManager = new HueSceneManager(that, that.hue_api, that.instance)
        that.groupManager = new HueGroupManager(that, that.hue_api, that.instance)
            // --------------------------
            // Fetch Lights
        setTimeout(function() {
                that.queryLights()
            }, Math.random() * 500)
            //fetch sensors
        setTimeout(function() {
                that.querySensors()
            }, Math.random() * 500)
            // Fetch the Groups
        setTimeout(function() {
                that.queryGroups()
            }, Math.random() * 500)
            // Fetch all Scenes
        setTimeout(function() {
            that.queryScenes()
        }, Math.random() * 500)

        setTimeout(function() {
            that.checkReady()
        }, 1)
    })

}

HuePlatform.prototype.setupEffectServer = function() {
    var that = this
    this.effectServers = {}
    var count = 0
    var efs = this.getConfiguredEffectServer()
    efs.forEach(function(definition) {
        var name = definition["name"]
        var lights = definition["lights"]
        var efserver = new HueEffectServer(that, name)

        lights.forEach(function(lightid) {
            that.log.debug("Try adding light with ID %s", lightid)
            var lightObject = that.lightWithId(lightid)
            if (lightObject) {
                efserver.addLight(lightObject)
            } else {
                that.log.error("Light with ID %s not found", lightid)
            }
        })
        count = count + 1
        that.effectServers[name] = efserver
    })

    // Create a HM Device if we had one EFXs
    if (count > 0) {
        this.sfxDevice = new HueSFXDevice(this)
        this.sfxDevice.setServerList(that.effectServers)
    }
}

HuePlatform.prototype.checkReady = function() {
    var that = this
    if ((this.lightsInitialized) && (this.groupsInitialized) && (this.scenesInitialized)) {
        this.plugin.initialized = true
        this.log.info("initialization completed")
        this.refreshAll()
    } else {
        setTimeout(function() {
            that.checkReady()
        }, 1000)
    }
}

HuePlatform.prototype.querySensors = function() {
    var that = this
    this.log.debug("Query sensors")
    this.hue_api.sensors.getAll().then(function(results) {
        if (results != undefined) {
            that.log.debug('%s sensors found', results.length)
            results.forEach(function(sensor) {
                that.log.debug("Try adding sensor %s", sensor['modelid'])
                switch (sensor['type'].toLowerCase()) {
                    case 'zlltemperature':
                        {
                            var devName = "HUEZT" + ((that.instance) ? that.instance : "0")
                            var hd = new HueTempSensor(that, that.hue_api, sensor, devName)
                            that.mappedDevices.push(hd)
                            that.sensors.push({
                                "name": sensor["name"],
                                "hm_device_name": hd.hmName
                            })
                        }
                        break

                    case 'daylight':
                        {
                            var devName = "HUEZD" + ((that.instance) ? that.instance : "0")
                            var hd = new HueDayLightSensor(that, that.hue_api, sensor, devName)
                            that.mappedDevices.push(hd)
                            that.sensors.push({
                                "name": sensor["name"],
                                "hm_device_name": hd.hmName
                            })
                        } //HueDayLightSensor
                        break

                    default:
                        {
                            that.log.debug("No handler found for %s", sensor['type'])
                        }
                }

            })
        }
    }).catch(function(_data) {
        that.log.error("query sensor error %s", _data)
    })
}

HuePlatform.prototype.persistantName = function(devName, id, uniqueid) {
    var persistenceFile = this.server.configuration.storagePath() + "/" + uniqueid + ".dev"
    try {
        var data = fs.readFileSync(persistenceFile)
            // Try to parse //
        var info = JSON.parse(data)
        return info['adress']
    } catch (e) {
        return devName + id
    }
}

HuePlatform.prototype.queryLights = function() {
    var that = this
    this.log.debug("Query Lights")
    this.hue_api.lights.getAll().then(function(lights) {
        if (lights != undefined) {
            try {
                lights.forEach(function(light) {
                    that.log.debug('processing %s', light.id)
                    var hd = undefined

                    switch (light["type"].toLowerCase()) {

                        case "on/off plug-in unit":
                            {
                                that.log.debug("Create new Osram Plug with name %s and id %s", light["name"], light["id"])
                                let devName = "OSRPLG" + ((that.instance) ? that.instance : "0")
                                hd = new HueDeviceOsramPlug(that, that.hue_api, light, devName)
                                light["hm_device_name"] = that.persistantName(devName, light["id"], light["uniqueid"])
                            }
                            break

                        case "extended color light":
                        case "color light":
                            {
                                that.log.debug("Create new Color Light with name %s and id %s ", light["name"], light["id"])
                                // Try to load device
                                let devName = "HUE000" + ((that.instance) ? that.instance : "0")
                                hd = new HueColorDevice(that, that.hue_api, light, devName)
                                light["hm_device_name"] = that.persistantName(devName, light["id"], light["uniqueid"])

                                hd.on("direct_light_event", function(alight) {
                                    // Call all EffectServer to stop
                                    that.log.debug("Some Lights are off Check the Scenes")
                                    Object.keys(that.effectServers).forEach(function(name) {
                                        var efx = that.effectServers[name]
                                        efx.stopSceneWithLight(alight)
                                    })
                                })

                            }
                            break

                        case "color temperature light":
                        case "dimmable light":
                            {
                                that.log.debug("Create new White Light with name %s and id %s", light["name"], light["id"])
                                // Try to load device
                                let devName = "HUE000" + ((that.instance) ? that.instance : "0")
                                hd = new HueDimmableDevice(that, that.hue_api, light, devName)
                                light["hm_device_name"] = that.persistantName(devName, light["id"], light["uniqueid"])

                                hd.on("direct_light_event", function(alight) {
                                    // Call all EffectServer to stop
                                    that.log.debug("Some Lights are off Check the Scenes")
                                    Object.keys(that.effectServers).forEach(function(name) {
                                        var efx = that.effectServers[name]
                                        efx.stopSceneWithLight(alight)
                                    })
                                })

                            }
                            break

                        default:
                            that.log.error("Sorry there is currently no mapping for %s please create an issue at github for that. Thank you.", light["type"])
                            break
                    }

                    if (hd != undefined) {
                        that.mappedDevices.push(hd)
                    }
                    that.lights.push(light)
                })
            } catch (e) {
                that.log.error("Sorry there was an error while initializing the lights ", e)
            }

            that.log.debug("Lightinit completed with " + that.lights.length + " devices mapped.")
            that.lightsInitialized = true


            // Setup All EffectServer
            that.setupEffectServer()

        }
    })

}


HuePlatform.prototype.queryGroups = function() {
    var that = this
    this.hue_api.groups.getAll().then(function(groups) {

        if (groups != undefined) {
            groups.forEach(function(group) {
                that.groupManager.addGroup(group)
            })
        }

        that.log.debug("Group loading completed. Will publish groups now .. (if there are some)")
        var publishedgroups = that.getConfiguredGroups()

        if (publishedgroups != undefined) {
            that.log.debug("Found some groups to publish ...")
            that.groupManager.publish(publishedgroups, false)
            that.log.debug("Aaaand i am done")
        }

        if (publishedgroups) {
            that.log.debug("Groupinit completed with " + publishedgroups.length + " devices mapped.")
        } else {
            that.log.debut("No groups ...set init to completed.")
        }

        that.groupsInitialized = true

    })
}

HuePlatform.prototype.queryScenes = function() {
    var that = this
    var scnt = 0
    this.hue_api.scenes.getAll().then(function(scenes) {
        if ((scenes != undefined) && (scenes != null)) {
            scenes.forEach(function(scene) {
                if (scene["owner"] != "none") {
                    scnt = scnt + 1
                    that.sceneManager.addScene(scene)
                }
            })
        }

        var publishedscenes = that.getConfiguredScenes()
        if (publishedscenes != undefined) {
            that.sceneManager.publish(publishedscenes, false)
        }

        if (publishedscenes) {
            that.log.debug("Sceneinit completed with " + publishedscenes.length + " scenes mapped.")
        } else {
            that.log.debut("No scenes ...set init to completed.")
        }
        that.scenesInitialized = true
    })
}

HuePlatform.prototype.getConfiguredGroups = function() {
    var ps = this.configuration.getPersistValueForPluginWithDefault(this.name, "PublishedGroups", undefined)
    if (ps != undefined) {
        try {
            return JSON.parse(ps)
        } catch (err) {
            this.log.warn("persistent group definition is broken. ignore that one.")
            this.configuration.setPersistValueForPlugin(this.name, "PublishedGroups", "[]")
            return []
        }
    }
    return []
}


HuePlatform.prototype.lightWithId = function(lightId) {
    return this.mappedDevices.filter(function(light) {
        return light.lightId == lightId
    }).pop()
}

HuePlatform.prototype.sensorWithId = function(sensorId) {
    return this.mappedDevices.filter(function(device) {
        return device.sensorUniqueId == sensorId
    }).pop()
}




HuePlatform.prototype.saveConfiguredGroups = function(publishedgroups) {
    var s = JSON.stringify(publishedgroups)
    this.configuration.setPersistValueForPlugin(this.name, "PublishedGroups", s)
}

HuePlatform.prototype.refreshAll = function() {
    var that = this
    this.log.debug("Refreshing Lamp status ...")
    var refreshrate = this.configuration.getValueForPluginWithDefault(this.plugin.name, "refresh", 60) * 1000
    this.mappedDevices.forEach(mdevice => {
        if (typeof mdevice.refreshLight === 'function') {
            mdevice.refreshLight()
        }
        if (typeof mdevice.refreshSensor === 'function') {
            mdevice.refreshSensor()
        }
    })
    this.lastUpdate = new Date()
    this.refreshTimer = setTimeout(function() {
        that.refreshAll()
    }, refreshrate)
    this.log.debug("Refreshed Lights Next in %s ms.", refreshrate)
}

HuePlatform.prototype.getConfiguredScenes = function() {
    var ps = this.configuration.getPersistValueForPluginWithDefault(this.name, "PublishedScenes", undefined)
    if (ps != undefined) {
        try {
            return JSON.parse(ps)
        } catch (err) {
            this.log.warn("persistent scene definition is broken. ignore that one.")
            this.configuration.setPersistValueForPlugin(this.name, "PublishedScenes", "[]")
            return []
        }
    }
    return []
}

HuePlatform.prototype.getConfiguredEffectServer = function() {
    var ps = this.configuration.getPersistValueForPluginWithDefault(this.name, "EffectServer", undefined)
    if (ps != undefined) {
        try {
            return JSON.parse(ps)
        } catch (err) {
            this.log.warn("persistent effect definition is broken. ignore that one.")
            this.configuration.setPersistValueForPlugin(this.name, "EffectServer", "[]")
            return []
        }
    }
    return []
}

HuePlatform.prototype.removeEffectServer = function(selSrv) {
    delete this.effectServers[selSrv]
    this.saveEffectScenes()
}


HuePlatform.prototype.saveConfiguredScenes = function(publishedscenes) {
    var s = JSON.stringify(publishedscenes)
    this.configuration.setPersistValueForPlugin(this.name, "PublishedScenes", s)
}

HuePlatform.prototype.saveEffectScenes = function(publishedscenes) {
    var efs = []
    var that = this

    Object.keys(this.effectServers).forEach(function(name) {
        var server = that.effectServers[name]
        efs.push(server.persinstentData())
    })
    var s = JSON.stringify(efs)
    this.configuration.setPersistValueForPlugin(this.name, "EffectServer", s)
}


HuePlatform.prototype.message = function(message, callback) {
    if ((message) && (message.name) && (callback)) {
        this.log.debug('Core message received : %s', message.name)
        if (message.name === 'getLights') {
            callback(undefined, this.lights)
            return
        }

        if ((message.name === 'getLightState') && (message.lightId)) {
            if (this.hue_api) {
                this.hue_api.lights.getLightState(message.lightId).then(function(lightState) {
                    callback(undefined, lightState)
                })
            } else {
                callback('api not initialized', undefined)
            }
            return
        }

        if ((message.name === 'setLightState') && (message.lightId) && (message.newState)) {
            if (this.hue_api) {
                this.hue_api.lights.setLightState(message.lightId, message.newState).then(function(err, result) {
                    callback(err, result)
                })
            } else {
                callback('api not initialized', undefined)
            }
            return
        }
    }
}

HuePlatform.prototype.handleConfigurationRequest = function(dispatched_request) {
    var listLights = ""
    var listSensors = ""
    var listGroups = ""
    var listScenes = ""
    var listEfxS = ""

    this.localization.setLanguage(dispatched_request)
    this.log.debug("handleConfigurationRequest")
    var message = this.localization.localize("No Message from your Hue Plugin. Yet ! Last Update : ")
    message = message + this.lastUpdate

    var requesturl = dispatched_request.request.url
    var queryObject = url.parse(requesturl, true).query


    var publishedscenes = this.getConfiguredScenes()
    if (publishedscenes == undefined) {
        publishedscenes = []
    }

    var publishedgroups = this.getConfiguredGroups()
    if (publishedgroups == undefined) {
        publishedgroups = []
    }


    if (!this.hue_ipAdress) {
        message = this.localization.localize("The plugin is searching for your bridge ....")
    } else {

        if (this.authorized == false) {
            message = this.localization.localize("Currently the plugin is not able to connect to the bridge. Please press the big button on your bridge to authorized the plugin.")
        }
    }

    var refresh = this.configuration.getValueForPluginWithDefault(this.name, "refresh", 60)

    if (queryObject["do"] != undefined) {

        switch (queryObject["do"]) {


            case "settings.save":
                {
                    var refresh = queryObject["refresh"]
                    this.configuration.setValueForPlugin(this.name, "refresh", refresh)
                    this.mappedDevices.forEach(function(light) {
                        light.reload()
                    })
                }
                break

            case "scenetoggle":
                {
                    var sceneid = queryObject["id"]
                    if (sceneid != undefined) {
                        var idx = publishedscenes.indexOf(sceneid)
                        if (idx > -1) {
                            publishedscenes.splice(idx, 1)
                        } else {
                            publishedscenes.push(sceneid)
                        }

                    }
                    this.saveConfiguredScenes(publishedscenes)
                }
                break

            case "grouptoggle":
                {
                    var groupid = queryObject["id"]
                    if (groupid != undefined) {
                        var idx = publishedgroups.indexOf(groupid)
                        if (idx > -1) {
                            publishedgroups.splice(idx, 1)
                        } else {
                            publishedgroups.push(groupid)
                        }

                    }
                    this.saveConfiguredGroups(publishedgroups)
                }
                break

            case "publish":
                {
                    if (this.sceneManager != undefined) {
                        this.log.debug("Publish all configured scenes %s", publishedscenes)
                        this.sceneManager.publish(publishedscenes, true)
                    }

                    if (this.groupManager != undefined) {
                        this.log.debug("Publish all configured groups %s", publishedgroups)
                        this.groupManager.publish(publishedgroups, true)
                    }

                }
                break


            case "efxs.removeServer":
                var servername = queryObject["efxs.name"]
                if (servername) {
                    this.removeEffectServer(servername)
                } else {
                    this.log.warn("Servername not provided %s", servername)
                }
                break


            case "efxs.createserver":
                {
                    var servername = queryObject["efxs.newname"]
                    if (servername) {
                        var efs = new HueEffectServer(this, servername)
                        this.effectServers[servername] = efs
                        this.saveEffectScenes()
                    } else {
                        this.log.warn("Servername not provided %s", servername)
                    }
                }
                break


            case "efxs.addlight":
                {
                    var servername = queryObject["efxs.name"]
                    var lightid = queryObject["light"]
                    var efs = this.effectServers[servername]
                    if (efs) {
                        this.log.debug("SFX Found")
                        var lightObject = this.lightWithId(lightid)
                        if (lightObject) {
                            this.log.debug("Add Light to efxs")
                            efs.addLight(lightObject)
                        }
                    }
                    this.saveEffectScenes()
                }
                break

            case "efxs.removelight":
                {
                    var servername = queryObject["efxs.name"]
                    var lightid = queryObject["light"]
                    var efs = this.effectServers[servername]
                    if (efs) {
                        this.log.debug("SFX Found")
                        var lightObject = this.lightWithId(lightid)
                        if (lightObject) {
                            this.log.debug("Remove Light from efxs")
                            efs.removeLight(lightObject)
                        }
                    }
                    this.saveEffectScenes()
                }
                break



            case "efxs.play":
                {
                    var scene = queryObject["efxs.scene"]
                    var servername = queryObject["efxs.name"]
                    var efs = this.effectServers[servername]
                    if (efs) {
                        efs.runScene(scene)
                    }

                }
                break

            case "efxs.stop":
                {
                    var servername = queryObject["efxs.name"]
                    var efs = this.effectServers[servername]
                    if (efs) {
                        efs.stopScene(true)
                    }
                }
                break

            case "efxs.stopall":
                {
                    Object.keys(this.effectServers).forEach(function(name) {
                        var efs = that.effectServers[name]
                        if (efs) {
                            efs.stopScene(true)
                        }
                    })
                }
                break

        }

    }


    var lighttemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_lamp_tmp.html", null)
    var grouptemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_group_tmp.html", null)
    var szenetemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_scene_tmp.html", null)

    var sensortemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_sensor_tmp.html", null)


    var efxtemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_efx_tmp.html", null)
    var efxSceneListtemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_efx_slist_tmp.html", null)
    var efxLighttemplate = dispatched_request.getTemplate(this.plugin.pluginPath, "list_efx_light_tmp.html", null)

    var that = this

    this.lights.forEach(function(light) {
        listLights = listLights + dispatched_request.fillTemplate(lighttemplate, {
            "lamp_name": light["name"],
            "lamp_hmdevice": light["hm_device_name"]
        })
    })

    this.sensors.forEach(function(sensor) {
        listSensors = listSensors + dispatched_request.fillTemplate(sensortemplate, {
            "sensor_name": sensor["name"],
            "sensor_hmdevice": sensor["hm_device_name"]
        })
    })


    if (this.groupManager != undefined) {

        this.groupManager.getMappedGroups().map(function(group) {
            var gid = String(group["id"])
            var idx = publishedgroups.indexOf(gid)
            var strindicator = (idx > -1) ? "[X]" : "[ ]"
            var hmChannel = (group["hm_device_name"] == undefined) ? "not mapped" : group["hm_device_name"]
            listGroups = listGroups + dispatched_request.fillTemplate(grouptemplate, {
                "groupid": group["id"],
                "published": strindicator,
                "lamp_name": group["name"],
                "lamp_hmdevice": hmChannel
            })
        })
    }

    if (this.sceneManager != undefined) {
        this.sceneManager.getMappedScenes().map(function(scene) {

            var idx = publishedscenes.indexOf(scene["id"])

            var strindicator = (idx > -1) ? "[X]" : "[ ]"
            var hmChannel = (scene["hmchannel"] == undefined) ? "not mapped" : scene["hmchannel"]
            listScenes = listScenes + dispatched_request.fillTemplate(szenetemplate, {
                "sceneid": scene["id"],
                "published": strindicator,
                "lamp_name": scene["name"],
                "lamp_hmdevice": hmChannel
            })
        })
    }

    // Build EfxS List
    Object.keys(this.effectServers).forEach(function(name) {
        that.log.debug("Show EfxS %s", name)
        var lightList = ""
        var scenelist = ""
        var efxs = that.effectServers[name]
        if (efxs) {

            that.lights.forEach(function(light) {
                var hazLight = efxs.hasLightWithId(light["id"])
                var inUse = (hazLight == true) ? "X" : " "
                var efxsfunction = (hazLight == true) ? "removelight" : "addlight"

                lightList = lightList + dispatched_request.fillTemplate(efxLighttemplate, {
                    "efxs.name": name,
                    "lamp.name": light["name"],
                    "lamp.lampid": light["id"],
                    "lamp.inuse": inUse,
                    "efxs.function": efxsfunction
                })
            })

            efxs.listScenes().forEach(function(scene) {
                scenelist = scenelist + dispatched_request.fillTemplate(efxSceneListtemplate, {
                    "efxs.scene": scene
                })
            })

            listEfxS = listEfxS + dispatched_request.fillTemplate(efxtemplate, {
                "efxs.name": name,
                "efxs.lights": lightList,
                "efxs.scenes": scenelist
            })

        }
    })

    dispatched_request.dispatchFile(this.plugin.pluginPath, "index.html", {
        "refresh": refresh,
        "listLights": listLights,
        "listGroups": listGroups,
        "listScenes": listScenes,
        "listSensors": listSensors,
        "listEfxS": listEfxS,
        "message": message
    })
}

module.exports = HuePlatform