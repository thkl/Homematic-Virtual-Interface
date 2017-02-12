//
//  Server.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

'use strict'


var HomematicLogicalLayer = require(__dirname + '/HomematicLogicLayer.js').HomematicLogicalLayer
var Config = require(__dirname + '/Config.js').Config
var ConfigServer = require(__dirname + '/ConfigurationServer.js').ConfigurationServer
var Plugin = require(__dirname + '/VirtualDevicePlugin.js').VirtualDevicePlugin

var path = require('path')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) {appRoot =  appRoot+'/../lib'}
if (appRoot.endsWith('node_modules/daemonize2/lib')) {appRoot =  appRoot+'/../../../lib'}
appRoot = path.normalize(appRoot)

var logger = require(__dirname + '/logger.js').logger('Homematic Virtual Interface.Server')

var HomematicChannel = require(__dirname + '/HomematicChannel.js').HomematicChannel
var HomematicDevice = require(__dirname + '/HomematicDevice.js').HomematicDevice
var fs = require('fs')
var url = require('url')

var Server = function() {
	logger.debug('Starting up')
	this.configuration = Config
}


Server.prototype.init = function() {
	var that = this

	this.configuration.load()
	
	if (this.configuration.getValue('enable_debug') === true) {
		require(__dirname + '/logger.js').setDebugEnabled(true)
	}
	
	this.configServer = new ConfigServer(this.configuration)
	this.homematicChannel = HomematicChannel
	this.homematicDevice = HomematicDevice
	this.configuratedPlugins = []
	this.activePlugins = []
	this.updateResult
	this.myPathHandler=['/','/index/','/settings/','/install/','/device/','/plugins/']
	
	this.localization = require(__dirname + '/Localization.js')(__dirname + '/Localizable.strings')
	this.hm_layer = new HomematicLogicalLayer(this.configuration)
	this.hm_layer.init()
	this.plugins = this._loadPlugins()
	
	this.configServer.on('config_server_http_event' , function (dispatched_request) {
		var requesturl = dispatched_request.request.url
		var parsed = url.parse(requesturl,true)
		var isMy = that.myPathHandler.indexOf(parsed.pathname.toLowerCase())
		if ((!parsed.pathname) || (isMy>-1)) {
			that.handleConfigurationRequest(dispatched_request)
  		} else {
	  		var handled=false
	  		
	  		that.configuratedPlugins.forEach(function (plugin){
		  		if (parsed.path.startsWith('/' + plugin.name)) {
			  	   plugin.handleConfigurationRequest(dispatched_request)
		  	  	   handled = true
		  	  } 
		  	})
		  	
		  	if (handled === false) {
		  		dispatched_request.dispatchFile(null,dispatched_request.request.url)
		  	}
  		}
	})
}

Server.prototype.shutdown = function() {
	this.getBridge().shutdown()
	this.getConfigurationServer().shutdown()
	
	this.configuratedPlugins.forEach(function (plugin){
	  plugin.platform.shutdown()		 
	})

	this.configuratedPlugins = []
	logger.info('Shutdown completed, bon voyage')
}

Server.prototype.getBridge = function() {
  return this.hm_layer
}

Server.prototype.getConfigurationServer = function() {
  return this.configServer
}


Server.prototype.dependenciesInitialized = function(dependencies) {
  var result = true
  var that = this

  if (dependencies) {
  
  	// uuuuh this is just dirty stuff .. ø\_(. .)_/ø 
  	
	if (typeof dependencies === 'string') {
		  dependencies = [dependencies]
  	}
  
	 dependencies.forEach(function (dplugin){
		 that.configuratedPlugins.forEach(function (plugin){
			 if ((plugin.name === dplugin) && (plugin.initialized === false)) {
				 result = false
			 }
		 })
	 })
  }
  return result
}




Server.prototype.addDefaultIndexAttributes = function(attributes) {
	
	attributes['haz_update']=(this.updateResult === -1) ? '(1)':''
	return attributes
}

Server.prototype.handleConfigurationRequest = function(dispatched_request) {
	
	var requesturl = dispatched_request.request.url
	var that = this
	var cfg_handled = false
	this.localization.setLanguage(dispatched_request)
	var parsed = url.parse(requesturl,true)

	if (parsed.pathname === '/') {
	  
	  // this.updateResult = this.checkUpdate()
	  
	  var pluginString=''
	  var pluginSettings = ''
	  
	  var plugin_settings_template = dispatched_request.getTemplate(null , 'plugin_item_ws.html',null)
	  var plugin_no_settings_template = dispatched_request.getTemplate(null , 'plugin_item_wos.html',null)
	  
	  this.configuratedPlugins.forEach(function (plugin){
		  pluginString = pluginString + '<li><a href="' + plugin.name + '">' + plugin.name + '</a></li>'
		  var hazSettings = (typeof(plugin.platform.showSettings) === 'function')
		  var pversion = that.getVersion(plugin)
		  pluginSettings = pluginSettings + dispatched_request.fillTemplate((hazSettings === true) ? plugin_settings_template:plugin_no_settings_template,
		  														{'plugin.name':plugin.name,
			  													 'plugin.version':pversion
		  														})
	  })
	  
	  var cs = 0
	  var csd = ''
	  var zeroMessage = ''
	  var ipccu = this.localization.localize('unknow CCU ip')
	  var bridge = this.getBridge()
	  if (bridge != undefined) {
		  cs = bridge.listConsumer().length
	      bridge.listConsumer().forEach(function(consumer){
		      csd = csd + consumer.description() + ' | '
	      })
	      ipccu = 'CCU IP: ' +  bridge.ccuIP
	      if (cs === 0) {
		     zeroMessage = this.localization.localize('It seems that your ccu does not know anything about the Homematic-Virtual-Layer. If you are sure about the CCU-IP, and the correct settings in your CCU InterfacesList.xml, a CCU reboot may help.')
	      }
	  }
	  
	  var sysversion = this.getVersion(undefined)
	  csd = csd + this.localization.localize('Last Message ') + bridge.lastMessage

	  dispatched_request.dispatchFile(null,'index.html',this.addDefaultIndexAttributes({'message':'',
		  																				'plugins':pluginString,
		  																				'pluginSettings':pluginSettings,
		  																				'consumer':cs,
		  																				'consumer.detail':csd,
		  																				'consumer.zeromessage':zeroMessage,
		  																				'system.version':sysversion,
		  																				'system.ipccu':ipccu
		  																				}))
	  cfg_handled = true
	} else {

	switch(requesturl) {
		
    case '/index/?installmode':
        this.hm_layer.publishAllDevices(function() {
			dispatched_request.dispatchFile(null,'action.html',that.addDefaultIndexAttributes({'message':that.localization.localize('all devices published')}))
		})
		cfg_handled = true
        break

    case '/index/?checkupdate':
   	    var update = this.checkUpdate()
   	    var message = 'You are up to date'
   	    var link = '#'
   	    
   	    if (update === -1) {
	   	    message = that.localization.localize('There is an update available.')
	   	    link='/index/?doupdate'
	   	}
	   	
   	    dispatched_request.dispatchFile(null,'update.html',this.addDefaultIndexAttributes({'message':message,'link':link}))
		cfg_handled = true
        break
        
    case '/index/?doupdate':
   	    var update = this.doUpdate()
   	    dispatched_request.dispatchFile(null,'update.html',this.addDefaultIndexAttributes({'message':update,'link':'#'}))
		cfg_handled = true
        break

	case '/index/?cleanup':
   	    this.hm_layer.cleanUp()
   	    var update = that.localization.localize('All connections removed. Please restart your CCU.')
    	dispatched_request.dispatchFile(null,'index.html',this.addDefaultIndexAttributes({'message':update,'link':'#'}))
		cfg_handled = true
        break

	case '/index/?showlog':
		var options = {
			start:  0,
			rows: 9999999,
			order:  'desc',
			fields: ['message','label','level','timestamp']
		}
				
		logger.query(options, function (err, result) {
			var str = ''
			result.dailyRotateFile.some(function (msg){
				str = str + msg.timestamp  + '('+msg.label+') [' + msg.level + '] - ' + msg.message + '\n'
			})
			dispatched_request.dispatchFile(null, 'log.html' ,{'logData':str})
 		})

		cfg_handled = true
        break

	case '/index/?enabledebug':
		this.configuration.aetValue('enable_debug',true)
        break

	case '/index/?disabledebug':
		this.configuration.aetValue('enable_debug',false)
        break

	
	case '/index/?restart':
   	    this.restart()
    	dispatched_request.dispatchFile(null,'restart.html',this.addDefaultIndexAttributes({'message':'Rebooting','link':'#'}))
		cfg_handled = true
        break

	}
		
	if (parsed.pathname === '/settings/')
	{
		var result = {}
		if (parsed.query['plugin']!=undefined) {
			that.configuratedPlugins.forEach(function (plugin){
			  if (plugin.name === parsed.query['plugin']) {
				 result['plugin.name'] = plugin.name
				 var ret = that.handlePluginSettingsRequest(dispatched_request,plugin) 
				 if (ret) {
					 result['editor'] = ret
				 } else {
				 	 cfg_handled = true
					 return
				 }
			  }	
			})
		}
		dispatched_request.dispatchFile(null,'plugin_settings.html',this.addDefaultIndexAttributes(result))
		cfg_handled = true
	}
	
	if (parsed.pathname === '/install/')
	{
		if (parsed.query['plugin']!=undefined) {
			var plugin = parsed.query['plugin']
			try {
				var Installer = require(__dirname + '/Installer.js')
				var i = new Installer(appRoot + '/../plugins/' + plugin)
				i.installDependencies(appRoot + '/../plugins/' + plugin)
				
			} catch (e) {
				logger.error(e.stack)
			}		
		}
	}
	
	if (parsed.pathname === '/plugins/')
	{
		// generate a List
	    var plugin_template = dispatched_request.getTemplate(null , 'plugin_item.html',null)

		var result = ''
		this.allPlugins().some(function (pluginObject){
			logger.info(pluginObject)
			result = result + dispatched_request.fillTemplate(plugin_template,
		  														{'plugin.type':pluginObject.type,
			  													'plugin.active':(pluginObject.active)?'[X]':'[ ]'	
		  														})
		})
		dispatched_request.dispatchFile(null,'plugins.html',this.addDefaultIndexAttributes({'plugins':result}))
		cfg_handled = true

	}
	
	if (parsed.pathname === '/device/')
	{ 
		
		
		if (parsed.query['do'] != undefined) {

			switch (parsed.query['do']) {
			
			case 'remove':
				if (parsed.query['adr']!=undefined) {
					this.hm_layer.deleteDeviceWithAdress(parsed.query['adr'])
   	    		}
   				dispatched_request.dispatchFile(null,'service.html',this.addDefaultIndexAttributes({'message':'Will try to remove Device','link':'#'}))
			 break

			case 'restore':
				if (parsed.query['adr']!=undefined) {
					var adr = parsed.query['adr']
					var deletedDevices = this.configuration.getPersistValueWithDefault('deletedDevices',[])
					var index = deletedDevices.indexOf(adr)
					if (index > -1) {
						deletedDevices.splice(index, 1)
					}
					this.configuration.setPersistValue('deletedDevices',deletedDevices)
   	    		}
   				dispatched_request.dispatchFile(null,'service.html',this.addDefaultIndexAttributes({'message':'Will try to restore Device','link':'#'}))
			 break

			}
			
		} else {
			// Generate List
			var deletedDevices = this.configuration.getPersistValueWithDefault('deletedDevices',[])
			var template = dispatched_request.getTemplate(null , 'removed_device_item.html',null)
			var result = ''
			deletedDevices.some(function (device){
				result = result + dispatched_request.fillTemplate(template,{'device.adress':device})
			});
			dispatched_request.dispatchFile(null,'removed_devices.html',this.addDefaultIndexAttributes({'devices':result}))
		}

		cfg_handled = true        
	}

	if (cfg_handled === false) {
        dispatched_request.dispatchMessage('404 Not found')
    }
   
   }

}

Server.prototype.handlePluginSettingsRequest = function(dispatched_request,plugin) {
  
  var fields = plugin.platform.showSettings(dispatched_request)

  if (dispatched_request.post != undefined) {
	  var newSettings = {}
	  var operation = dispatched_request.post['op']
	  fields.some(function (field){
	  	 newSettings[field.name] = dispatched_request.post[field.name]
	  })
	  plugin.platform.saveSettings(newSettings)
	  dispatched_request.redirectTo('/')
	  return undefined
  } else {
	  var settings_text_template = dispatched_request.getTemplate(null , 'settings_text.html',null)
	  var settings_option_template = dispatched_request.getTemplate(null , 'settings_option.html',null)
	  
	  var result = ''
	  fields.some(function (field){
	 
	  switch (field.control) {
		 
		 case 'text':
		 case 'password':
		 {
			 
			var control = {'plugin.name':plugin.name,'control.name':field.name,
			 	'control.value':(field.value) ? field.value : '',
			 	'control.label':field.label,
			 	'control.description':(field.description) ? field.description : '',
			 	'control.size':(field.size) ? field.size : '25',
			 	'control.type':(field.control === 'password') ? 'password':'text'
			}
		 	
		 	result = result + dispatched_request.fillTemplate(settings_text_template,control)
		 	
		 }
		 break
		 
		 case 'option':
		 {
			 
			var control = {'plugin.name':plugin.name,'control.name':field.name,
			 	'control.value':(field.value) ? 'checked=\'checked\'' : '' ,'control.label':field.label,
			 	'control.description':(field.description) ? field.description : '',
			 	'control.size':(field.size) ? field.size : '25'
			}
		 	
		 	result = result + dispatched_request.fillTemplate(settings_option_template,control)
		 	
		 }
		 break
		 
		 
	  }
  	})
  
  }
  
  return result	  
}

Server.prototype.pluginWithName = function(name) {
	var result = undefined
	this.configuratedPlugins.some(function (plugin){
		if (name === plugin.name) {
			result = plugin
		}
	})
	return result
}


Server.prototype.isPluginConfigured = function(type) {
	var result = false
	var that = this
	var configuredPlugins = this.configuration.getValue('plugins')
	if (configuredPlugins!=undefined) {
    	configuredPlugins.forEach(function (pdef){
	    	if (pdef['type'] === type) {
		    	result = true
	    	}
    	})
    }
	return result
}

Server.prototype.isPluginActive = function(type) {
   return (this.activePlugins.indexOf(type)>-1)
}

Server.prototype.allPlugins = function() {
	var result = []
	var that = this
	Plugin.installed().forEach(function(plugin) {
	  var pl = {'type':plugin.type(),
		  	   'active':that.isPluginActive(plugin.type())
		  	   }
	  
	  result.push(pl)
	})
	
	return result
}


Server.prototype._loadPlugins = function() {

  var plugins = {}
  var foundOnePlugin = false
  var that = this
  
  
  // load and validate plugins - check for valid package.json, etc.
  Plugin.installed().forEach(function(plugin) {


	if (that.isPluginConfigured(plugin.type())) {
		

   //try {
      plugin.load()
		if (!plugin.loadError) {
			plugins[plugin.type()] = plugin
			logger.info('Loaded plugin: ' + plugin.type())
		}
   /*}
    catch (err) {
      logger.error('--------------------')
      logger.error('ERROR LOADING PLUGIN ' + plugin.type() + ':')
      logger.error(      err.message)
      logger.error(err.stack)
      logger.error('--------------------')
      plugin.loadError = err
    }
	}
	*/
	}
  })
  
	  // Try to find 

  var configuredPlugins = this.configuration.getValue('plugins')
  
  if (configuredPlugins!=undefined) {
      
	  for (var i=0 ; i<configuredPlugins.length ; i++) {

        // Load up the class for this accessory
        var pluginConfig = configuredPlugins[i]
        logger.debug('Plugin Config %s',JSON.stringify(pluginConfig))
        var pluginType = pluginConfig['type'] 
        var pluginName = pluginConfig['name']
		var pluginDissabled = pluginConfig['dissabled'] || false
    	var plg = plugins[pluginType]
    	  
    	 if ((plg!=undefined) && (pluginDissabled===false)) {
	       // call the plugin's initializer and pass it the API instance
		   var pluginLogger = require(__dirname + '/logger.js').logger(pluginType + ' - ' + pluginName)
		   var plg_instance = new plg.initializer(this,pluginName,pluginLogger,plg.instance)
		   plg_instance.pluginPath = plg.pluginPath
		   logger.info(plg_instance.name +' initialized. Document Path is %s Plugin Instance: %s',plg_instance.pluginPath,plg.instance)
		   this.configuratedPlugins.push(plg_instance)
		   this.activePlugins.push(pluginType)
		   plg.instance = plg.instance + 1
		   foundOnePlugin = true
    	 }  else {
		   logger.error('%s Plugin is not active.',pluginType)	    	 
    	 } 
      }
    }


  // Complain if you don't have any plugins.
  if (!foundOnePlugin) {
    logger.warn('No plugins found. See the README for information on installing plugins.')
  }


  this.configuratedPlugins.filter(function (plugin) { logger.debug('Plugin Name %s',plugin.name)})

  return plugins
}

Server.prototype.checkUpdate = function() {
    
    var result = -1
    
    try {	
	  var cmd = 'cd ' + appRoot + '/..;git remote update;git status'
	  logger.info('Check Update Command is %s',cmd)
	  var status = require('child_process').execSync(cmd).toString().trim()
	  logger.info('Response %s',status)
	  var pos = status.indexOf('up-to-date')
	  result = pos
	} catch (e) {
		logger.error(e)
		result = 0
	}
	return result
}

Server.prototype.doUpdate = function() {
    try {	
	require('child_process').execSync('cd ' + appRoot + '/..;git pull')
		return 'please Restart .....'
	 } catch (e) {
		logger.error(e)
		return 'non git version'
	}
}

Server.prototype.restart = function() {
  try {	
	 var cmd = appRoot + '/../bin/hmviservice restart'
	logger.info('Rebooting (%s)',cmd)
	var exec = require('child_process').exec
	var child = exec(cmd)
	logger.info('done ')
  } catch (e) {
	logger.error('Error while trying to reboot ',e)
  }
}

Server.prototype.getVersion = function(plugin) {
  try {	
	var pfile = appRoot + '/../package.json'	  
	if (plugin) {
		pfile = plugin.pluginPath + '/package.json'	  
	}
	
	var buffer = fs.readFileSync(pfile)
    var json = JSON.parse(buffer.toString())
    return json['version']
	} catch (e) {
		logger.error(e.stack)
  }
}

module.exports = {
  Server: Server
}
