//
//  Server.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//

'use strict'


var path = require('path')
var HomematicLogicalLayer = require(path.join(__dirname , 'HomematicLogicLayer.js')).HomematicLogicalLayer
var Config = require(path.join(__dirname , 'Config.js')).Config
var ConfigServer = require(path.join(__dirname , 'ConfigurationServer.js')).ConfigurationServer
var Plugin = require(path.join(__dirname , 'VirtualDevicePlugin.js')).VirtualDevicePlugin
var crypto = require('crypto');
var httpHeaders = require('http-headers');
var dgram = require('dgram');

const regaRequest = require(path.join(__dirname,  'HomematicReqaRequest.js'))

var appRoot = path.join(__dirname,'..');
appRoot = path.normalize(appRoot)

var logger = require(__dirname + '/logger.js').logger('Homematic Virtual Interface.Server')

var HomematicChannel = require(__dirname + '/HomematicChannel.js').HomematicChannel
var HomematicDevice = require(__dirname + '/HomematicDevice.js').HomematicDevice
var fs = require('fs')
var url = require('url')

var Server = function() {
	logger.debug('Starting up')
	this.cleanLog()
	this.configuration = Config
}


Server.prototype.init = function() {
	var that = this

	this.configuration.load()
	
	if (this.configuration.getValue('enable_debug') === true) {
		require(__dirname + '/logger.js').setDebugEnabled(true)
	}
	logger.info("running on node version %s",process.version)
	logger.info("hello from the flight deck. my path is %s",appRoot)
	logger.info("starting point was %s",path.dirname(require.main.filename))
	this.configuratedPlugins = []
	this.configServer = new ConfigServer(this.configuration)
	this.homematicChannel = HomematicChannel
	this.homematicDevice = HomematicDevice
	this.updateResult
	this.myPathHandler=['/','/index.html','/index/','/settings/','/install/','/device/','/plugins/','/security/']
	this.npmCommand = this.configuration.getValueWithDefault("npm_command","npm");
	this.npmUpdate = this.configuration.getValueWithDefault("npm_update_command","update");
	this.serviceLauncher = this.configuration.getValueWithDefault('serviceLauncher','/etc/init.d/hvl_service');
	this.serviceEnableCommand = this.configuration.getValueWithDefault('serviceEnableCommand','sudo chmod +x /etc/init.d/hvl_service;sudo update-rc.d hvl_service defaults;');
	this.serviceDisableCommand = this.configuration.getValueWithDefault('serviceDisableCommand','sudo rm /etc/init.d/hvl_service;sudo update-rc.d hvl_service remove')
	this.backupCommand = this.configuration.getValueWithDefault('backupCommand','tar -C %config% --exclude=logs/* -czvf /tmp/hvl_backup.tar.gz .')
	this.localization = require(__dirname + '/Localization.js')(__dirname + '/Localizable.strings')
	this.hm_layer = new HomematicLogicalLayer(this.configuration)
	this.hm_layer.init()
	this.ccuAlive = false
	this.initSSDPBroadcaster();

	logger.info('Pinging CCU')
	this.hm_layer.runRegaScript('Write("PING");',function(result) {
				
		if (result) {
			logger.info('CCU is alive')
			that.ccuAlive = true
		} else {
			logger.error('No rega response')
		}
	})

	this.cachedPluginList = []
	this.reloadPlugins()
	
	
	
	
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
	setTimeout(function () {
		that.cleanLog()
	}, 3600000)
	
	
	process.on('unhandledRejection', (reason, p) => {
  		that.log.error('Unhandled Rejection at: Promise', p, 'reason:', reason.stack);
    });
}


Server.prototype.addSSDPService = function(options) {
	logger.info("Add UPnP Service %s",options.st)
	this.ssdpServices.push(options)
}

Server.prototype.removeSSDPServiceByOwner = function(owner) {
    for(var i = 0; i < this.ssdpServices.length; i++) {
    var obj = this.ssdpServices[i]

    if (obj.owner == owner) {
	    logger.info('remove %s from UPnP',obj.st)
        this.ssdpServices.splice(i, 1);
        i--
    }
    }
}

Server.prototype.initSSDPBroadcaster = function() {
	var that = this
  	this.ssdpServices = []
  	this.ssdp = dgram.createSocket('udp4');
    this.ssdp.bind(1900, undefined, function() {
        that.ssdp.addMembership('239.255.255.250');
        that.ssdp.on('message', function(msg, rinfo) {
            var msgString = msg.toString();
            if (msgString.substr(0, 10) == 'M-SEARCH *') {
	            var headers = httpHeaders(msg);
                if ((headers.man === '"ssdp:discover"') || (headers.man === 'ssdp:discover')) {
                
                that.ssdpServices.forEach(function (options) {
                	if ((headers.st == options.st) || (headers.st == 'ssdp:all')){
                	var responseBuffer = new Buffer(options.payload);
					logger.debug("SSDP discovery returning message for %s (%s)",options.owner ,options.st)
					setTimeout(function() {
						that.ssdp.send(responseBuffer, 0, responseBuffer.length, rinfo.port, rinfo.address);
					}, Math.random(10)*100);
                	}
                })
                
                }
            }
        })
        
        that.ssdp.on("error", function (error) {
            logger.error("SSDP Broadcaster Error : %s",error)
        }
    );
    });
}

Server.prototype.getCoreRootFolder = function() {
  return appRoot;
}

Server.prototype.reloadPlugins = function() {
	logger.info('Reload .. shutdown all plugins')
	this.configuratedPlugins.forEach(function (plugin){
	  plugin.platform.shutdown()		 
	})

	this.activePlugins = []
	this.ssdpServices = []
	this.configuratedPlugins = []
	this.plugins = this._loadPlugins()
}

Server.prototype.cleanLog = function() {
	var LoggerQuery = require(__dirname + '/logger.js').LoggerQuery
    new LoggerQuery("").clean(5)
}

Server.prototype.shutdown = function() {
	this.getBridge().shutdown()
	this.getConfigurationServer().shutdown()
	this.configuratedPlugins.forEach(function (plugin){
	  plugin.platform.shutdown()		 
	})
	this.configuratedPlugins = []
	logger.info('remove all UPnP advertizements')

	if (this.ssdp && this.ssdp._bindState) this.ssdp.close();
	
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

	
	if ((parsed.pathname === '/') || (parsed.pathname === '/index.html')) {
	  
	  // this.updateResult = this.checkUpdate()
	  
	  var pluginString=''
	  var pluginSettings = ''
	  
	  var plugin_settings_template = dispatched_request.getTemplate(null , 'plugin_item_ws.html',null)
	  var plugin_no_settings_template = dispatched_request.getTemplate(null , 'plugin_item_wos.html',null)
	  
	  this.configuratedPlugins.forEach(function (plugin){
		  pluginString = pluginString + '<li><a href="' + plugin.name + '/">' + plugin.name + '</a></li>'
		  //var hazSettings = (typeof(plugin.platform.showSettings) === 'function')
		  
		  var hazSettings = true
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
	      ipccu = 'CCU IP: ' +  bridge.ccuIP + ((this.ccuAlive == true) ? " alive " : " no response")
	      if (cs === 0) {
		     zeroMessage = this.localization.localize('It seems that your ccu does not know anything about the Homematic-Virtual-Layer. If you are sure about the CCU-IP, and the correct settings in your CCU InterfacesList.xml, a CCU reboot may help.')
		     
		     if ((bridge.ccuIP!=undefined) && (bridge.ccuInterfaceFound==false)) {
		     let installMessage = this.localization.localize('If its the first run you have to setup your ccu click  <a href=\"/settings/?addInterface\">here to add HVL</a>')
		       zeroMessage = zeroMessage + " " + installMessage
		     }
		     
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
   	    
   	     var npmName = 'homematic-virtual-interface';
   		 var systemPath = appRoot; //lib/homematic-virtual-layer/node_modules
   		 if (this.isNPM(npmName,appRoot)) {
   	    	var message = 'You are using the npm version. Updates are shown at the main page.'
   		    var link = '#'
   	     } else {
   		 	var update = this.checkUpdate()
   	    	var message = 'You are up to date'
   		    var link = '#'
   	        if (update === -1) {
	   	    	message = that.localization.localize('There is an update available.')
	   	    	link='/index/?doupdate'
	   		}
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
		var LoggerQuery = require(__dirname + '/logger.js').LoggerQuery
		new LoggerQuery("").queryAll(function (err, result) {
			var str = ''
			result.some(function (msg){
				str = str + msg.time  + "["+ msg.module + "] [" + msg.level + "] - " + msg.msg + "\n";
			})
			dispatched_request.dispatchFile(null, 'log.html' ,{'logData':str})
 		})

		cfg_handled = true
        break

	case '/index/?enabledebug':
		this.configuration.setValue('enable_debug',true)
        break

	case '/index/?disabledebug':
		this.configuration.setValue('enable_debug',false)
        break
	
	case '/index/?daemon':
	
		if (this.hazDaemon()) {
    	dispatched_request.dispatchFile(null,'daemon.html',this.addDefaultIndexAttributes({'message':that.localization.localize('Disable HVL launch at boot'),'link':'/index/?disabledaemon'}))
			
		} else {
    	dispatched_request.dispatchFile(null,'daemon.html',this.addDefaultIndexAttributes({'message':that.localization.localize('Enable HVL launch at boot'),'link':'/index/?enabledaemon'}))
		}
	
		cfg_handled = true
	
		break;
	
	case '/index/?enabledaemon':
		this.enableDaemon()
    	dispatched_request.dispatchFile(null,'message.html',this.addDefaultIndexAttributes({'message':that.localization.localize('Added as service'),'link':'#'}))
		cfg_handled = true
        break

	case '/index/?disabledaemon':
		this.disableDaemon()    
    	dispatched_request.dispatchFile(null,'message.html',this.addDefaultIndexAttributes({'message':that.localization.localize('removed service'),'link':'#'}))
		cfg_handled = true
        break

	case '/index/?backup':
	    require('child_process').execSync('rm -f /tmp/hvl_backup.tar.gz')
	    let bCmd = this.backupCommand.replace(/%config%/gi, this.configuration.storagePath())
	    logger.debug('Backup with command %s',bCmd)
	    require('child_process').execSync(bCmd)
		dispatched_request.dispatchFile('/tmp','hvl_backup.tar.gz',null)
	    cfg_handled = true

	    break
	
	case '/index/?restart':
   	    setTimeout(function(){
	   	    that.restart()
	    }, 2000);
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
		
    	if (parsed.query['ccu']!=undefined) {
	    	let ccuip = parsed.query['ccu']
	    	logger.info("set ccu ip to %s ...",ccuip)
			this.configuration.setValue('ccu_ip',ccuip)
			setTimeout(function(){
	   	    	that.restart()
	   		}, 2000);
	   		dispatched_request.dispatchFile(null,'restart.html',this.addDefaultIndexAttributes({'message':'Rebooting','link':'#'}))
	   		cfg_handled = true
    		return
    	} 
	  	
	  	if (parsed.query['rebootCCU']!=undefined) {
		  let script = "system.Exec('reboot');"
		  new regaRequest(this.hm_layer,script,function(result){

		  });	
		  update = that.localization.localize('Your ccu reboots now.. Time to get a coffee...')
		  dispatched_request.dispatchFile(null,'restart_ccu.html',that.addDefaultIndexAttributes({'message':update,'link':'#'}))
		  cfg_handled = true
	 	  return
	  	}
	  	
	  	
	  	if (parsed.query['addInterfaceScript']!=undefined) {
		  	var script = this.prepareScriptFile('ccu_rcscript.txt')
	  		dispatched_request.dispatchMessage(script)
	  		cfg_handled = true

	  	}
	  	
	  	if (parsed.query['addInterfaceInstaller']!=undefined) {
		  	var script = this.prepareScriptFile('ccu_installer.txt')
	  		dispatched_request.dispatchMessage(script)
	  		cfg_handled = true
	  	}
	  	
	  	if (parsed.query['addInterface']!=undefined) {
		 	logger.info('try to add HVL as Service ...')

		  var script = 'string stdin;string stdout;string cmd;cmd="sh -c \'wget myProt://myIp:myPort/settings/?addInterfaceInstaller --no-check-certificate -O/tmp/i.sh\'";system.Exec(cmd,&stdin,&stdout);system.Exec("sh -c \'chmod +x /tmp/i.sh;/tmp/i.sh\'",&stdin,&stdout);WriteLine(stdout);'
			   script = this.prepareScript(script)
			   logger.info(script)
				new regaRequest(this.hm_layer,script,function(result){
					logger.info('HVL Add Result %s',result)
    			});

				update = '<a href=\'/settings/?rebootCCU\'>' + that.localization.localize('Please reboot your ccu') + '</a>'
				dispatched_request.dispatchFile(null,'restart_ccu.html',that.addDefaultIndexAttributes({'message':update,'link':'#'}))
				cfg_handled = true
    		
		}
	  	
		dispatched_request.dispatchFile(null,'plugin_settings.html',this.addDefaultIndexAttributes(result))
		cfg_handled = true
	}
	
	if (parsed.pathname === '/install/')
	{
		if (parsed.query['plugin']!=undefined) {
			var plugin = parsed.query['plugin']
			try {
				this.installPlugin(plugin,function(error){
					dispatched_request.dispatchMessage('{"result":'+(error)?'true':'false'+'}')
				})
			} catch (e) {
				logger.error(e.stack)
			}		
		}
		cfg_handled = true
	}
	
	if (parsed.pathname === '/plugins/')
	{
		if ((parsed.query['do']) && (parsed.query['plugin'])) {
			
			var plgtp = parsed.query['plugin']
			
			switch (parsed.query['do']) {
				
				case "activate":
			    	that.activatePlugin(plgtp)
				    dispatched_request.dispatchMessage('{"result":"true"}')
			    break;
			    
			    case "deactivate":
			    	that.deactivatePlugin(plgtp)
				    dispatched_request.dispatchMessage('{"result":"true"}')
			    break;	
			    
			    case "refresh":
			    	that.refreshPluginList();
				    dispatched_request.dispatchMessage('{"result":"true"}')
				break;
				
				case "update":
				    var updateList = []
				    
				    if (plgtp!='all') {
					        logger.info("Updating %s",plgtp)
					    	var pobj = that.pluginWithType(plgtp);
					    	if (pobj) {
						    	pobj.npm = plgtp
						    	updateList.push(pobj)
								that.doNPMUpdate(updateList)
								that.reloadPlugins()
					    	} else {
						    	logger.error("Update Object for %s not found",plgtp)
					    	}
							dispatched_request.dispatchMessage('{"result":"true"}')		
				    } else {
					        logger.info("Updating all plugins")
							this.fetchPluginList(function(error,lresult) {
							logger.debug("Plugin list %s",lresult)
							lresult.some(function (pluginObject){
							  if (pluginObject.installed) {
								  updateList.push(pluginObject)
							  }
							})
							that.doNPMUpdate(updateList)
							that.reloadPlugins()
							dispatched_request.dispatchMessage('{"result":"true"}')		
					})
				    }
				    
				    
				    
				break;
				
				case "version":
				   that.fetch_npmVersion(plgtp,function (centralVersion){
					   logger.debug("Get Version for %s result %s",plgtp,JSON.stringify(centralVersion))
					   dispatched_request.dispatchMessage('{"result":'+ JSON.stringify(centralVersion) +'}')
				   })
				break;
			}
				cfg_handled = true
		} else {
			
		// generate a List
	    var plugin_template = dispatched_request.getTemplate(null , 'plugin_item.html',null)

		var result = ''
		this.fetchPluginList(function(error,lresult) {
			if (error==null) {
				that.cachedPluginList = lresult
				lresult.some(function (pluginObject){
				var description = that.localization.getLocalizedStringFromModuleJSON(pluginObject.description)
				result = result + dispatched_request.fillTemplate(plugin_template,
		  															{'plugin.type':pluginObject.name,
			  														'plugin.installed':(pluginObject.installed)?'[X]':'[ ]',
			  														'plugin.active':(pluginObject.active)?'[X]':'[ ]',
			  														'plugin.description': description || '',
			  														'plugin.installbutton':(pluginObject.installed)? 'disabled="disabled"':'',	
			  														'plugin.activatebutton':((pluginObject.active) || (!pluginObject.installed)) ? 'disabled="disabled"':'',																	'plugin.version':(pluginObject.version) || 'unknow version',	
			  														'plugin.removebutton':(pluginObject.active)? '':'disabled="disabled"',
			  														'plugin.npm':pluginObject.npm
			  														})
			})
			} else {
				logger.error("Fetch Error %s",error)
			}
			dispatched_request.dispatchFile(null,'plugins.html',that.addDefaultIndexAttributes({'plugins':result}))
		})
		cfg_handled = true
		}

	}
	
	if (parsed.pathname === '/security/') 
	{
		
		
		if (dispatched_request.post != undefined) {
			var operation = dispatched_request.post['op']
			if (operation == 'save') {
				logger.info("Saving Settings -> Restart")
				var https = dispatched_request.post['settings_https']
				var auth = dispatched_request.post['settings_auth']
				var pwd = dispatched_request.post['settings_pwd']
				this.configuration.setValue('use_https',(https=='true'))
				this.configuration.setValue('use_http_auth',(auth=='true'))
				if ((pwd!=undefined) && (pwd!='')) {
					var md5 = crypto.createHash('md5').update(pwd).digest("hex");
					this.configuration.setValue('http_auth_pwd',md5)
				}
			}
		}
		
		
		var https = this.configuration.getValueWithDefault("use_https",false)
		var auth = this.configuration.getValueWithDefault("use_http_auth",false)
		var pwd = this.configuration.getValueWithDefault("http_auth_pwd",undefined)
		var settings_text_template = dispatched_request.getTemplate(null , 'settings_text.html',null)
		var settings_option_template = dispatched_request.getTemplate(null , 'settings_option.html',null)
		var result = ''
		
		result = result + dispatched_request.fillTemplate(settings_option_template,{'control.name':'settings_https','control.value':(https) ? 'checked=\'checked\'' : '' ,'control.label':that.localization.localize('Use https'),'control.description':''})
		result = result + dispatched_request.fillTemplate(settings_option_template,{'control.name':'settings_auth','control.value':(auth) ? 'checked=\'checked\'' : '' ,'control.label':that.localization.localize('Use HTTP Auth'),'control.description':''})
		result = result + dispatched_request.fillTemplate(settings_text_template,{'control.name':'settings_pwd','control.value': '' ,'control.label':that.localization.localize('Admin Password'),'control.description':'Username : admin',"control.type":"password"})


		dispatched_request.dispatchFile(null,'security.html',this.addDefaultIndexAttributes({'content':result}))
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

Server.prototype.prepareScriptFile = function(file) {
	let scriptFile = path.join(__dirname,file)
	var script = this.configuration.loadFile(scriptFile)
	return this.prepareScript(script)
}

Server.prototype.prepareScript = function(script) {
	
	let myIP = this.configuration.getMyIp() 
	let myPort = this.configuration.getValueWithDefault('web_http_port',8182)
	let myProt = (this.configuration.getValueWithDefault('use_https',false) == true) ? 'https' : 'http' 

	if (script) {
				script = script.replace(/myIP/gi, myIP) 
				script = script.replace(/myPort/, myPort) 
				script = script.replace(/myProt/, myProt) 
	}
	return script
}

Server.prototype.handlePluginSettingsRequest = function(dispatched_request,plugin) {
  
  var fields = (typeof plugin.platform.showSettings == 'function') ? plugin.platform.showSettings(dispatched_request) : []
  var dep = this.configuration.getValueForPluginWithDefault(plugin.name,"dependencies",[])
  var dplist = dep.join()
 
  fields.push({"control":"text",
					"name":"dependencies",
				   "label":this.localization.localize("Dependencies"),
				   "value":dplist || "",
		     "description":this.localization.localize("Plugins that need to launch befrore this. (, separated)")
  });
	
  if (dispatched_request.post != undefined) {
	  var newSettings = {}
	  var operation = dispatched_request.post['op']
	  fields.some(function (field){
	  	 newSettings[field.name] = dispatched_request.post[field.name]
	  })

	  if (typeof plugin.platform.saveSettings == 'function') {
		  plugin.platform.saveSettings(newSettings)
	  }

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

Server.prototype.pluginWithType = function(type) {
	var result = undefined
	this.configuratedPlugins.some(function (plugin){
		if (type === plugin.pluginType) {
			result = plugin
		}
	})
	return result
}

Server.prototype.isPluginConfigured = function(type) {
	var result = false
	var that = this
	var configuredPlugins = this.configuration.getValue('plugins')
	if ((configuredPlugins!=undefined) && (configuredPlugins instanceof Array)) {
    	configuredPlugins.forEach(function (pdef){
	    	if (pdef['type'] === type) {
		    	result = true
	    	}
    	})
    }
	return result
}


Server.prototype.hazDaemon = function() {
 return fs.existsSync(this.serviceLauncher)	
}

Server.prototype.enableDaemon = function() {
	this.configuration.setValue('daemon',true)
	require('child_process').execSync('sudo cp '+appRoot +'/lib/hmvi_npm ' + this.serviceLauncher)
	require('child_process').execSync(this.serviceEnableCommand)
}

Server.prototype.disableDaemon = function() {
	this.configuration.setValue('daemon',false)
	require('child_process').execSync(this.serviceDisableCommand)
}


Server.prototype.isPluginActive = function(type) {
   return (this.activePlugins.indexOf(type)>-1)
}

Server.prototype.deactivatePlugin = function(type) {
  	logger.info("Trying to disable %s ",type)
  	var that = this
	var success = false
	var configuredPlugins = this.configuration.getValue('plugins')
	if ((configuredPlugins!=undefined) && (configuredPlugins instanceof Array)) {
    	configuredPlugins.forEach(function (pdef){
	    	if (pdef['type'] === type) {
		    	logger.info("Found %s set disable to true",type)
		    	pdef['disabled']=true
		    	success = true
	    	}
    	})
    }
    
    if (success==true) {
	    this.configuration.setValue('plugins',configuredPlugins)
		this.reloadPlugins()
	}
}

Server.prototype.activatePlugin = function(type) {
	var configuredPlugins = this.configuration.getValue('plugins')

	if (configuredPlugins == undefined) {
		configuredPlugins = []
	}

	var found = false
	if (configuredPlugins!=undefined) {
    	configuredPlugins.forEach(function (pdef){
	    	if (pdef['type'] === type) {
		    	logger.info("Found %s set disable to false",type)
		    	pdef['disabled']=false
		    	found = true
	    	}
    	})
    }
    
    if (!found) {
	    // Generate new Entry
	    var defs = this.getPluginDefaults(type)
	    if (defs) {
		    var newPluginEntry = {
			    "type":type,
				"name":defs.syname,
				"disabled":false
	    	}
			logger.info("Have to build new entry for %s",type)
			configuredPlugins.push(newPluginEntry)		    
	    }
    }
    
    this.configuration.setValue('plugins',configuredPlugins)
	this.reloadPlugins()
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


Server.prototype.isPluginTypeInstalled = function(type) {
	var that = this
	var result = false
	Plugin.installed().forEach(function(plugin) {
		if (type == plugin.type()) {
			result = true
		}
	})
	return result
}

Server.prototype.getVersionForPluginWithType = function(type) {
	var that = this
	var result = false
	Plugin.installed().forEach(function(plugin) {
		if (type == plugin.type()) {
			result = plugin.version
		}
	})
	return result
}

Server.prototype.getPluginPath = function(type) {
	var that = this
	var result = false
	Plugin.installed().forEach(function(plugin) {
		if (type == plugin.type()) {
			result = plugin.pluginPath
		}
	})
	return result
}



Server.prototype.getPluginDefaults = function(type) {
  var result = {}
  	this.cachedPluginList.some(function (pobj){
		if (pobj.npm==type) {
			result = pobj	
		}	
	})
  return result
}

Server.prototype.installPlugin = function(type,callback) {
  var that = this
  this.fetchPluginList(function (error,list){
	if (error==null) {
		list.some(function (pobj){
			if (pobj.npm==type) {
				// should be outside of /usr/local/node_modules/homematic-virtual blafasel
				logger.debug("my Root Path is %s",appRoot)
				let lastPart = appRoot.endsWith('homematic-virtual-interface') ? '..':''
				that.installNPM(pobj.npm,path.normalize(path.join(appRoot,'..',lastPart)))
				that.reloadPlugins()
			}	
		})
		if(callback) {callback(null)}
	}  else {
		if(callback) {callback(error)}
	}
  })
}		   	 

Server.prototype.refreshPluginList = function(callback) {
   var request = require('request')
   var url = 'https://raw.githubusercontent.com/thkl/Homematic-Virtual-Interface/master/plugins/plugins.json?'+new Date()
   var that = this
   var result = [];
   try {
   
   	request({url: url,json: true}, function (error, response, body) {
   	 if (!error && response.statusCode === 200) {
	   	 var pluginFile = that.configuration.storagePath() + "/plugins.json";
		 logger.info("save plugin file : %s",pluginFile);
		 var buffer = JSON.stringify(body,null, 2);
		 fs.writeFileSync(pluginFile, buffer)
		 if (callback) {callback(null,[])}
   	 }
   	})

   	} catch (e) {
	   logger.error('Fetch Plugins Error %s',e.stack)
	   if (callback) {callback(error,[])}
    }
}


Server.prototype.fetchPluginList = function(callback) {
	var pluginFile = this.configuration.storagePath() + "/plugins.json";
	var that = this
	if (fs.existsSync(pluginFile)) {	
    		var buffer = fs.readFileSync(pluginFile);
			var result = JSON.parse(buffer.toString());
			this.buildPluginList(result,callback);
	} else {
		this.refreshPluginList(function(){
    		var buffer = fs.readFileSync(pluginFile);
			var result = JSON.parse(buffer.toString());
			that.buildPluginList(result,callback);
		})
	}
}
	
	
Server.prototype.buildPluginList = function(body,callback) {	
	var that = this;
  	if ((body) && (body['plugins']))  {
		var result = body['plugins']
		result.some(function (aPlugin){
			aPlugin.installed = that.isPluginTypeInstalled(aPlugin.npm)
			aPlugin.active = that.isPluginActive(aPlugin.npm)
			aPlugin.version = that.getVersionForPluginWithType(aPlugin.npm)
			aPlugin.pluginPath = that.getPluginPath(aPlugin.npm)
		});
		
		if (callback) {
			callback(null,result)
		}
	   	
	} else {
	   if (callback) {callback(null,result)}
	}
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
        //logger.debug('Plugin Config %s',JSON.stringify(pluginConfig))
        var pluginType = pluginConfig['type'] 
        var pluginName = pluginConfig['name']
		var pluginDisabled = pluginConfig['disabled'] || false
    	var plg = plugins[pluginType]
    	  
    	 if ((plg!=undefined) && (pluginDisabled===false)) {
	       try {
	        // call the plugin's initializer and pass it the API instance
			var pluginLogger = require(__dirname + '/logger.js').logger(pluginType + ' - ' + pluginName)
		    var plg_instance = new plg.initializer(this,pluginName,pluginLogger,plg.instance)
			plg_instance.pluginPath = plg.pluginPath
			plg_instance.pluginType = pluginType
			logger.info(plg_instance.name +' initialized. Document Path is %s Plugin Instance: %s',plg_instance.pluginPath,plg.instance)
			this.configuratedPlugins.push(plg_instance)
			this.activePlugins.push(pluginType)
			plg.instance = plg.instance + 1
			foundOnePlugin = true
    	 } catch (loadError) {
	    	 logger.error("Cannot initialize %s - %s",pluginName,loadError.stack)
    	 }
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


Server.prototype.transferHMDevice = function(deviceType,devidedefinition) {
 // store the json in devidedefinition to ./devices/devicetype.json
   var cfgFile = path.join(path.dirname(fs.realpathSync(__filename)), '..','devices' , deviceType) + '.json';
   if (!fs.existsSync(cfgFile)) {
        var buffer = JSON.stringify(devidedefinition,null, 2);
		fs.writeFileSync(cfgFile, buffer); 
   }
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
		logger.error("Core Check update error %s",e.stack)
		result = 0
	}
	return result
}

Server.prototype.doUpdate = function() {
    var npmName = 'homematic-virtual-interface';
    var systemPath = path.join(appRoot,'..','..'); //lib/homematic-virtual-layer/node_modules
    logger.info('Update at root %s (%s)',appRoot,systemPath)
    if (this.isNPM(npmName,appRoot)) {
	    logger.info('Its an npm')
   		var exec = require('child_process').exec;
   		var cmd = 'cd ' + systemPath + ';' + this.npmCommand + ' ' + this.npmUpdate +' ' + npmName + ' --production --prefix "' + systemPath + '"'
   		logger.info(cmd)
		require('child_process').execSync(cmd)
		return 'please Restart .....'
    } else {
	    logger.info('Git Version')
    	try {	 
			require('child_process').execSync('cd ' + path.join(appRoot,'..').normalize()+';git pull')
			return 'please Restart .....'
	 	} catch (e) {
			logger.error("Core Update Error %s",e.stack)
			return 'non git version'
		}
	}
}


Server.prototype.doNPMUpdate = function(packageNames) {
	var that = this
	packageNames.some(function (pluginObject){
	try {
		var npmName = pluginObject.npm
		// destination is one above the plugin path
		var destPath = path.normalize(path.join(pluginObject.pluginPath,'..','..')) 
		logger.info("Updateing %s in %s",npmName,destPath)
		var exec = require('child_process').exec;
		var cmd = 'cd ' + destPath + ';' + that.npmCommand + ' ' + that.npmUpdate +' ' + npmName + ' --production --prefix "' + destPath + '"'
		require('child_process').execSync(cmd);
    }
    catch (err) {
	    logger.error("Update error for %s - %s",npmName,err)
	}
	});
}


Server.prototype.installNPM = function(npmName,destPath) {
	logger.info("Installing %s to %s",npmName,destPath)
	var exec = require('child_process').exec;
	var cmd = 'cd ' + destPath + ';' + this.npmCommand + ' install ' + npmName + ' --production --prefix "' + destPath + '"'
	require('child_process').execSync(cmd);
}


Server.prototype.isNPM = function(npmName,destPath) {
	var pjsonPath = path.join(destPath, "package.json");
	logger.info("Checking NPM on %s",pjsonPath)
	try {
     var pjson = JSON.parse(fs.readFileSync(pjsonPath));
     return (pjson['_id']!=undefined)
    }
    catch (err) {
	    logger.error("Check NPM Error %s",err.stack)
	    return false
	}
}

Server.prototype.restart = function() {
  try {	
	var cmd = this.configuration.getValueWithDefault("restart_command",appRoot + '/bin/hmviservice restart');  
	logger.info('Restart (%s)',cmd)
	var exec = require('child_process').exec
	var child = exec(cmd)
	logger.info('done ')
  } catch (e) {
	logger.error('Error while trying to reboot %s',e)
  }
}




Server.prototype.fetch_npmVersion = function(pck, callback) {
  var httpUtil = require(path.join(__dirname, 'Util.js'));
  httpUtil.httpCall("GET","https://registry.npmjs.org/" + pck + "/",[],function (data,error){
	try {
		if (data) {
			var registry = JSON.parse(data);
			
			if (registry) {
				let latestVersion = registry['dist-tags']['latest']
				let remark = registry['versions'][latestVersion]['remark'] || ''
				if (callback) {callback({'version':latestVersion,'remark':remark})}
			} else {
				if (callback) {callback({'version':'unknow','remark':''})}
			}
		} else {
				if (callback) {callback({'version':'unknow','remark':''})}
		}
	} catch (err){
		logger.error("Error while checking NPM Version of %s - %s",pck,e.stack)
		if (callback) {callback("unknow")}
	}  
  })
}


Server.prototype.getVersion = function(plugin) {
  try {	
	var pfile = path.join(__dirname,'..','package.json')	  
	if (plugin) {
		pfile = path.join(plugin.pluginPath,'/package.json')
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
