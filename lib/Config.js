//
//  Config.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

// static Class

'use strict'

var fs = require('fs')
var path = require('path')
var logger = require(path.join(__dirname, '/logger.js')).logger('Config')

var customStoragePath

function Config () {

}

Config.setCustomStoragePath = function (path) {
  customStoragePath = path
}

Config.storagePath = function () {
  if (customStoragePath) {
    return customStoragePath
  }
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  let cpath = path.join(home, '.hm_virtual_interface')
  // Create config path if not exists
  if (!fs.existsSync(cpath)) {
    fs.mkdirSync(cpath)
  }

  return cpath
}

Config.userHome = function () {
  var home = process.env.HOME || process.env.HOMEPATH || process.env.USERPROFILE
  return home
}

Config.loadFile = function (filename) {
  if (fs.existsSync(filename)) {
    var buffer = fs.readFileSync(filename, 'utf8')
    return buffer
  }
  return undefined
}

Config.load = function () {
  try {
    var configFile = Config.storagePath() + '/config.json'
    logger.info('try to load config : %s', configFile)
    var buffer = fs.readFileSync(configFile)
    Config.settings = JSON.parse(buffer.toString())
    if (Config.settings === undefined) {
      Config.settings = {}
    }
  } catch (e) {
    logger.warn('There was a problem reading your config.json file (%s).', configFile)
    logger.warn('Please verify your config.json at http://jsonlint.com')
    Config.settings = {}
  }

  try {
    var persistFile = Config.storagePath() + '/persist.json'
    logger.debug('try to load persistent storage : %s', persistFile)
    if (fs.existsSync(persistFile)) {
      buffer = fs.readFileSync(persistFile)
      Config.persist = JSON.parse(buffer.toString())
    }
    if (Config.persist === undefined) {
      Config.persist = {}
    }
  } catch (e) {
    Config.persist = {}

    // remove file if exists
    if (fs.existsSync(Config.storagePath() + '/persist.json')) {
      fs.unlink(Config.storagePath() + '/persist.json')
    }
    logger.error('Persist File is corrupt. Created a new one.You have to restart your ccu if layer finised loading ...')
  }
}

Config.save = function () {
  try {
    var buffer = JSON.stringify(Config.settings, null, 2)
    fs.writeFileSync(Config.storagePath() + '/config.json', buffer)
  } catch (e) {
    logger.error('there is no config file at ', Config.storagePath())
  }
}

Config.savePersistence = function () {
  try {
    var buffer = JSON.stringify(Config.persist, null, 2)
    fs.writeFileSync(Config.storagePath() + '/persist.json', buffer)
  } catch (e) {
    logger.error('error while saving to persist file at ', Config.storagePath())
  }
}

Config.savePersistentObjektToFile = function (object, fileName, callback) {
  try {
    var buffer = JSON.stringify(object, null, 2)

    if (callback) {
      fs.writeFile(Config.storagePath() + '/' + fileName + '.json', buffer, function (err) {
        if (err) {
          logger.error(err)
        }
        callback()
      })
    } else {
      fs.writeFileSync(Config.storagePath() + '/' + fileName + '.json', buffer)
    }
  } catch (e) {
    logger.error('error while saving to persist file at %s', fileName)
  }
}

Config.loadPersistentObjektfromFile = function (fileName) {
  var result = {}
  try {
    var persistFile = Config.storagePath() + '/' + fileName + '.json'
    logger.debug('try to load persistent storage : %s', persistFile)
    if (fs.existsSync(persistFile)) {
      var buffer = fs.readFileSync(persistFile)
      result = JSON.parse(buffer.toString())
    }
  } catch (e) {
    logger.error('Persist File %s is corrupt. (%s)', fileName, e)
  }
  return result
}

Config.getPersistValue = function (key) {
  return Config.getPersistValueWithDefault(key, undefined)
}

Config.getPersistValueForPlugin = function (plugin, key) {
  return Config.getPersistValueWithDefault(plugin + '.' + key, undefined)
}

Config.getPersistValueForPluginWithDefault = function (plugin, key, value) {
  return Config.getPersistValueWithDefault(plugin + '.' + key, value)
}

Config.getPersistValueWithDefault = function (key, defaultValue) {
  if (Config.persist !== undefined) {
    var x = Config.persist[key]
    if (x !== undefined) {
      return x
    } else {
      return defaultValue
    }
  } else {
    return defaultValue
  }
}

Config.setPersistValueForPlugin = function (plugin, key, value) {
  Config.persist[plugin + '.' + key] = value
  Config.savePersistence()
}

Config.setPersistValue = function (key, value) {
  Config.persist[key] = value
  Config.savePersistence()
}

Config.getValue = function (key) {
  return Config.getValueWithDefault(key, undefined)
}

Config.getValueWithDefault = function (key, defaultValue) {
  if (Config.settings !== undefined) {
    var x = Config.settings[key]
    if (x !== undefined) {
      return x
    } else {
      return defaultValue
    }
  } else {
    return defaultValue
  }
}

Config.setValue = function (key, value) {
  Config.settings[key] = value
  Config.save()
}

Config.getValueForPlugin = function (plugin, key) {
  return Config.getValueForPluginWithDefault(plugin, key, undefined)
}

Config.getSettingsForPlugin = function (aPluginName) {
  var configuredPlugins = Config.getValue('plugins')
  if (configuredPlugins !== undefined) {
    for (var i = 0; i < configuredPlugins.length; i++) {
      var pluginConfig = configuredPlugins[i]
      var pluginName = pluginConfig['name']
      if (pluginName === aPluginName) {
        // logger.debug(JSON.stringify(pluginConfig));
        return pluginConfig
      }
    }
  }
  return undefined
}

Config.getValueForPluginWithDefault = function (plugin, key, defaultValue) {
  if (Config.settings !== undefined) {
    var px = Config.getSettingsForPlugin(plugin)
    if (px !== undefined) {
      var x = px[key]
      if (x !== undefined) {
        return x
      } else {
        return defaultValue
      }
    } else {
      return defaultValue
    }
  } else {
    return defaultValue
  }
}

Config.setValueForPlugin = function (plugin, key, value) {
  if (Config.settings !== undefined) {
    var px = Config.getSettingsForPlugin(plugin)
    if (px !== undefined) {
      px[key] = value
    }
  }
  Config.save()
}

Config.getMyIp = function () {
  var localip = Config.getValue('local_ip')

  if (localip === undefined) {
    localip = Config.getIPAddress()
  }
  if (localip === '0.0.0.0') {
    logger.error('Cannot fetch my own ip')
  }

  logger.info('MyIP is %s', localip)
  return localip
}

Config.httpsCertificates = function (callback) {
  const pem = require('pem')

  // try to find an existing cert
  var pemFile = Config.storagePath() + '/cert.pem'
  var certFile = Config.storagePath() + '/cert.cert'
  if (fs.existsSync(certFile)) {
    var certificate = fs.readFileSync(certFile).toString()
    /* eslint-disable handle-callback-err */
    pem.readCertificateInfo(certificate, function (err, cert) {
      var validto = cert.validity.end
      var date = new Date().getTime()
      if (validto > date) {
        logger.info('Certficicate is valid until %s so we will use it', new Date(validto))
        callback({ key: fs.readFileSync(pemFile).toString(), cert: certificate })
      } else {
        // certificate is not valid ; remove it and create a new one
        logger.warn('Certificate is not valid anymore. Build a new one')
        fs.unlink(pemFile)
        fs.unlink(certFile)
        Config.generateCertificate(function (cert) {
          callback(cert)
        })
      }
    })
  } else {
    Config.generateCertificate(function (cert) {
      callback(cert)
    })
  }
}

Config.generateCertificate = function (callback) {
  const pem = require('pem')
  var pemFile = Config.storagePath() + '/cert.pem'
  var certFile = Config.storagePath() + '/cert.cert'
  var myIp = Config.getMyIp()

  var certInfo = {
    issuer: {},
    country: 'DE',
    state: 'Berlin',
    locality: 'Berlin',
    organization: 'HVL',
    organizationUnit: 'HVL',
    commonName: myIp,
    emailAddress: 'root@' + myIp,
    dc: '',
    signatureAlgorithm: 'sha256WithRSAEncryption',
    publicKeyAlgorithm: 'rsaEncryption',
    publicKeySize: '2048 bit',
    days: 360,
    selfSigned: true
  }

  logger.warn('have to create a new ssl certificate')
  pem.createCertificate(Object.create(certInfo), function (err, keys) {
    if (err) {
      logger.error('Certificate generation error %s', err)
    } else {
      logger.info('saving certifcate for further use')
      fs.writeFileSync(pemFile, keys.serviceKey)
      fs.writeFileSync(certFile, keys.certificate)
    }

    callback({ key: keys.serviceKey, cert: keys.certificate })
  })
}

Config.getIPAddress = function () {
  var interfaces = require('os').networkInterfaces()
  for (var devName in interfaces) {
    var iface = interfaces[devName]
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) { return alias.address }
    }
  }
  return '0.0.0.0'
}

Config.getMacAddress = function () {
  var interfaces = require('os').networkInterfaces()
  for (var devName in interfaces) {
    var iface = interfaces[devName]
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i]
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) { return alias.mac }
    }
  }
  return '00:00:00:00:00:00'
}

module.exports = {
  Config: Config
}
