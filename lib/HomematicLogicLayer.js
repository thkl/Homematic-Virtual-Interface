//
//  HomematicLogicalLayer.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

const path = require('path')
const Url = require("url")
const fs = require('fs')
const util = require('util')

const xmlrpc = require(path.join(__dirname,  '/homematic-xmlrpc'))
const request = require('request')
const logger = require(path.join(__dirname,  '/logger.js')).logger('HomematicLogicalLayer')
const HomematicChannel = require(path.join(__dirname,  'HomematicChannel.js')).HomematicChannel
const HomematicDevice = require(path.join(__dirname,  'HomematicDevice.js')).HomematicDevice
const regaRequest = require(path.join(__dirname,  '/HomematicReqaRequest.js'))
const EventEmitter = require('events')

var RPCConsumer = function() {
	this.multicallPayload = []
}


RPCConsumer.prototype.methodCall = function (method, params, callback) {
	var that = this
	if (this.errorCount < 10) {
	logger.debug('RPC Out -> method:%s | params:%s',method,JSON.stringify(params))
	this.client.methodCall(method , params, function(error, value) {
		if (error) {
			that.errorCount =  that.errorCount + 1
			logger.error('Error while sending message %s:%s %s (%s) %s-%s',that.hostname,that.port,error,that.errorCount,method,JSON.stringify(params))
		} else {
			that.errorCount = 0
		}
		callback(error,value)
	});
	} else {
		logger.warn('Discarding Message Consumer will be removed soon')
		callback('error',null)
	}
}


RPCConsumer.prototype.encode = function() {
	return {'hostname':this.hostname,'port':this.port,'path':this.path,'callbackid':this.callbackid}
}

RPCConsumer.prototype.initwithurl = function(ccuip,urlstring,callbackid) {

 // replace xmlrpc_bin 
 // have to replace it first otherwise Url.parse will not work 
  
 /* 
  if (urlstring.indexOf('xmlrpc_bin') === 0) {
     urlstring = urlstring.replace('xmlrpc_bin', 'http')
  }

  if (urlstring.indexOf('xmlrpc') === 0) {
     urlstring = urlstring.replace('xmlrpc', 'http')
  }
*/

  var purl = Url.parse(urlstring)
  this.port = (purl.port != null) ? purl.port : 80
  this.path = purl.pathname
  this.callbackid = callbackid
  this.errorCount = 0
  this.hostname = purl.hostname
  
/*
  // FW > 3.41
  if (this.port > 30000) {
	  this.port = this.port - 30000;
  }
  switch (purl.hostname) {
	  
	  case '127.0.0.1':
	  
      if (purl.protocol === 'protocol') {
	      purl.protocol = 'http'
      }

	  this.hostname = ccuip
	  break

	  case undefined:
	  this.hostname = ccuip
	  break
	  
	  default:
	  this.hostname = purl.hostname
  }
  
  */
  
  logger.info('init new consumer with host %s at port %s path %s',JSON.stringify(this.hostname),this.port,this.path)
  
  this.client = xmlrpc.createClient({
			host: this.hostname,
			port: this.port,
			path: this.path
  })
}

RPCConsumer.prototype.initwithcoder = function(encodedobject,ccuip) {


  this.port = encodedobject.port
  this.path = encodedobject.path
  this.callbackid = encodedobject.callbackid
  this.errorCount = 0
  if (encodedobject.hostname === undefined) {
	  encodedobject.hostname = '127.0.0.1'
  }
  
  if (encodedobject.hostname === '127.0.0.1') {
	  this.hostname = ccuip
  } else {
	  this.hostname = encodedobject.hostname
  }
  
  logger.info('init stored consumer with host %s at port %s path %s',this.hostname,this.port,this.path)
	this.client = xmlrpc.createClient({
			host: this.hostname,
			port: this.port,
			path: this.path
  	})
}

RPCConsumer.prototype.description = function() {
  return this.hostname + ':' + this.port + this.path
}

RPCConsumer.prototype.isEqual = function(rpcconsumer) {

  var result = true
  if (this.port != rpcconsumer.port) {
	  result = false
  }
  
  if (this.hostname != rpcconsumer.hostname) {
	  result = false
  }
  
  if (this.path != rpcconsumer.path) {
	  result = false
  }
  return result
}


var HomematicLogicalLayer = function (config) {
	this.rpc_server
	this.clients = []
	this.devices = []
	this.rpcClient
	this.interfaceID
	this.interfaceCallbackId
	this.config = config
	this.consumer = []
	this.homematicChannel = HomematicChannel
	this.homematicDevice = HomematicDevice
	this.lastMessage = ''
	this.rpcClients = {}
	this.rpcEventServer = undefined
	this.CCUEventcache = {}
	this.ccuInterfaceName = 'HVL'
	this.hvlserver = undefined
	this.isCollectingMulticalls = false
	this.ccu_user = this.config.getValue('ccu_user')
	this.ccu_pass = this.config.getValue('ccu_pass')
	this.ccuIP = this.config.getValue('ccu_ip')
	if (this.ccuIP === undefined) {
		logger.error('Please setup your ccu ip at the WebUI Main Page')
	} else {
	    logger.info('Welcome. will create a interface layer for CCU at %s', this.ccuIP)
		this.loadConsumer(this.ccuIP)
	}
}

util.inherits(HomematicLogicalLayer, EventEmitter)

HomematicLogicalLayer.prototype.init = function() {
    var that = this
	this.maxRPCTimeOut = (this.config.getValue('max_rpc_message_timeout') || 5) * 60000

	var localPort = this.config.getValue('local_rpc_port') || 7000
    var localip = this.config.getMyIp() 	
    this.localip = localip
	this.localport = localPort
	var serverOptions = (this.config.getValue('bind_all') === undefined) ? {host:localip,port:localPort}:{port:localPort}
	
	try {

	this.rpc_server = xmlrpc.createServer(serverOptions)

	} catch (e) {
		logger.error ('Can\'t start rpc')
	}


	this.rpc_server.on('NotFound', function(method, params) {
      logger.debug('Method %s does not exist. - %s' , method , JSON.stringify(params))
	})

	logger.info('XML-RPC server for interface Homematic Virtual Interface is listening on %s:%s', (serverOptions.host)?serverOptions.host:'0.0.0.0',serverOptions.port)
	
	logger.info('CCU RPC message timeout set to %s ms', this.maxRPCTimeOut)


 	this.methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
	   		that.lastMessage = new Date()
	   	    logger.debug('rpc < system.listMethods (%s)', params)
            logger.debug('repl  > %s', JSON.stringify(Object.keys(that.methods)))
            callback(null,Object.keys(that.methods))
    },
    
    'listDevices': function listDevices(err, params, callback) {
	    	
	   		that.lastMessage = new Date()
       		logger.debug('rpc < listDevices %s', params)
       		 var devices = that.getMyDevices();
             callback(null, devices);
    },
    
    'getDeviceDescription': function getDeviceDescription(err, params, callback) {
    
	   		that.lastMessage = new Date()
		    logger.debug('rpc < getDeviceDescription %s', params)
    		var adress = params[0]
			var found = false
			var isDeviceAdress = (adress.indexOf(':')=== -1)
			var device = that.deviceWithAdress(adress)
			
			if ((!device) && (isDeviceAdress)) {
				if (!device) {
					logger.debug("Device not found %s",adress)
				}
				that.autoDeleteDevice(adress)
			}
			
			if (device) {
				var re = device.getDeviceDescription()
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    found = true
	    	    callback(null,re)
	    	    return
			} else {
				var channel = that.channelWithAdress(adress)
				if (channel) {
					var re = channel.getChannelDescription()
					logger.debug('repl  > %s', JSON.stringify(re))
					found = true
					callback(null,re)
					return
				} else {
					logger.debug('repl > getDeviceDescription %s', 'Nothing Found')
					callback({'faultCode':-2,'faultString':'Unknown instance'},undefined)
				}
			}
    },
    
    
    'getLinks': function getLinks(err, params, callback) {
	   		that.lastMessage = new Date()
		    logger.debug('rpc < getLinks %s', params)
		    logger.debug('repl  > %s', [])
    		callback(null,[])
     },
    
    
    'getValue': function getValue(err, params, callback) {
	   		that.lastMessage = new Date()
    		logger.debug('rpc < getValue %s', params)
		    var adress = params[0]
			var parameterName = params[1]
			that.devices.forEach(function (device) {
	    	  	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress === adress) {
	    	    var re = channel.getParamsetValue('VALUES',parameterName)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    return
	    	  }
	   	     })
	    	})
	    	callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
     },
    
    'setValue': function setValue(err, params, callback) {
	   		that.lastMessage = new Date()
    		logger.debug('rpc < setValue %s', params)
		    var adress = params[0]
			var parameterName = params[1]
			var value = params[2]
			that.devices.forEach(function (device) {
				device.channels.forEach(function (channel) {
	    	    if (channel.adress === adress) {
	    	   		logger.debug('repl  > %s %s', null, null)
	    	   		callback(null,undefined)
	    	    	channel.setValue(parameterName,value)
					return
	    	  }
	   	     })
	    	})
	    	// Always anwser the phone
			callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
     },
    

    
    'getParamsetDescription': function getParamsetDescription(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < getParamsetDescription %s', params)
			var adress = params[0]
			var paramset = params[1]
			var found = false
			that.devices.forEach(function (device) {
	    	  if (device.adress === adress) {
	    	    var re = device.getParamsetDescription(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    found = true
	    	    return
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress === adress) {
	    	    var re = channel.getParamsetDescription(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    found = true
	    	    return
	    	  }
	   	     });
	    	  
	    	});

		if (found === false) {	    	
	    	logger.debug('repl > getParamsetDescription', "Nothing Found")
			callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
		}
	},

    'getParamsetId': function getParamsetId(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < getParamsetId %s', params)
			var adress = params[0]
			var paramset = params[1]
			that.devices.forEach(function (device) {
	    	  if (device.adress === adress) {
	    	    var re = device.getParamsetId(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    return
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress === adress) {
	    	    var re = channel.getParamsetId(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    return
	    	  }
	   	     })
	    	})
	    	callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
	},

   'getParamset': function getParamset(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < getParamset %s', params)
			var adress = params[0]
			var paramset = params[1]
			that.devices.forEach(function (device) {
	    	  if (device.adress === adress) {
	    	    var re = device.getParamset(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    return
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress === adress) {
	    	    var re = channel.getParamset(paramset)
	    	    logger.debug('repl  > %s', JSON.stringify(re))
	    	    callback(null,re)
	    	    return
	    	  }
	   	     })
	    	})
	    	callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
	},


	'reportValueUsage': function reportValueUsage(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < reportValueUsage %s', params)
			// thank you for the fish ...
			callback(null,[]);
	},


	'deleteDevice': function deleteDevice(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < deleteDevice %s', params)
			var adress = params[0]
			var mode = params[1]
			logger.debug('repl  >', [])
			callback(null,[]);
			
			// call Bridge and set Flag
			var device = that.deviceWithAdress(adress)
			if (device != undefined) {
				that.deleteDevice(device,false)
			}
			// rega callback
			that.sendRPCMessage(undefined,'deleteDevices',[adress], function(error, value) {})
	},


	'getLinkPeers': function getLinkPeers(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < getLinkPeers %s', params)
			var adress = params[0]
			var mode = params[1]
			logger.debug('repl  >', null)
			callback(null,[])
	},

	'system.methodHelp' : function methodHelp(err,params,callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < methodHelp %s %s', err, params)
			logger.debug('repl  >', null)
			callback(null,[])
	},


    'putParamset': function putParamset(err, params, callback) {
	   		that.lastMessage = new Date()
			logger.debug('rpc < putParamset %s', params)
			var adress = params[0]
			var paramset = params[1]
			var parameters = params[2]
			that.devices.forEach(function (device) {
	    	  if (device.adress === adress) {
	    	    var re = device.putParamset(paramset,parameters)
	    	    logger.debug('repl  >', null, JSON.stringify(re))
	    	    device.resetConfigPending()
				that.saveDevice(device)
	    	    callback(null,re)
	    	    return;
	    	  }
	    	  
	    	  device.channels.forEach(function (channel) {
	     		if (channel.adress === adress) {
	    	    var re = channel.putParamset(paramset,parameters)
	    	    logger.debug('repl  > %s',JSON.stringify(re))
	    	    device.resetConfigPending()
				that.saveDevice(device)
	    	    callback(null,re)
	    	    return;
	    	  }
	   	     })
	    	})
			callback({"faultCode":-2,"faultString":"Unknown instance"},undefined)
	},
	
    'init' : function init(err, params, callback) {
	   		that.lastMessage = new Date()
            logger.debug('rpc < init %s', params)
            var url = params[0]
            var intf = params[1]

 			var cns = new RPCConsumer()
 			
 			if ((intf !== undefined) && (intf != "")) {
	 			
	 				logger.info("initwithurl %s",url)
	 				url = that.fixCCUInitCall(url)
	 				logger.info("initwith fixed url %s",url)
	 			
	 				cns.initwithurl(that.ccuIP,url,params[1])
	 				that.addConsumer(cns)
	 				that.saveConsumer()
	 				logger.info('connection request at %s with callback %s .. live is good',url,params[1])
	 				logger.info('%s dude(s) to publish events',that.consumer.length)
	 				
	 				callback(null,[])
 			} else {
	 			var purl = Url.parse(url)
	 			cns = that.consumerWithHost(purl.hostname)
 				if (cns != undefined) {
	 				that.removeConsumer(cns)
	 				that.saveConsumer()
	 				logger.info('there is a removal for %s',purl.hostname)
	 				logger.info('%s dude(s) to publish events',that.consumer.length)
				}
				callback(null,[])
			}
	},
	
	'ping' : function ping (err,params,callback) {
			that.lastMessage = new Date()
		    logger.debug('rpc < ping %s', params)
		    logger.debug('repl  > %s', 'pong to all consumers')
		    that.pong(params)
    		callback(null,1)
	}
	
	};


    Object.keys(that.methods).forEach(function (m) {
           that.rpc_server.on(m, that.methods[m])
    })
    
	this.rpc_server.close = function() {
		logger.info('RPC Server was removed.')
    }
    
    // Check if ccu is here
	this.checkCCUAlive()
    
}



HomematicLogicalLayer.prototype.fixCCUInitCall = function(url) {
	let that = this
	var o_replacements = this.config.loadPersistentObjektfromFile("rega_fail");
	logger.debug('Replacement data %s',JSON.stringify(o_replacements))
	if ((o_replacements === undefined) || (o_replacements['init_replacements'] === undefined)) {
	  // Create a default file
	  o_replacements = {}
	  logger.debug('Have to create a new replacement file to deal with 127.0.0.1 rega init calls')
	  o_replacements['init_replacements'] = []
	  o_replacements['init_replacements'].push({"xmlrpc_bin://127.0.0.1:31999": "http://$ccuip$:1999"})
	  o_replacements['init_replacements'].push({"http://127.0.0.1:39292/bidcos": "http://$ccuip$:9292/bidcos"})
	  this.config.savePersistentObjektToFile(o_replacements,"rega_fail");
  	}

  	var a_replacements = o_replacements['init_replacements']
  	
	a_replacements.forEach(function (o_replacement) {
		
		Object.keys(o_replacement).forEach(function (r_url){
		if (url === r_url) {
			url = o_replacement[r_url]
			logger.debug("will change to %s",url)
		}
		})
		
	})
	url = url.replace("$ccuip$", that.ccuIP)
	return url
}

HomematicLogicalLayer.prototype.checkCCUAlive = function() {
    var that = this

	logger.debug('Pinging CCU')

    this.ccuPing(function (result){
	    // if ccu is alive get my interfacename and check corpses
	    if (result == true) {
		    logger.debug('CCU seems to be alive. these are good news so far')
			that.getmyInterfaceNameOnCCU(that.localip,that.localport,function(ifName){
				logger.info('apply interface Name %s to all devices',ifName)
				that.devices.some(function (device){
				device.interfaceName = ifName 
	    	})
			setTimeout(function(){
		    	that.checkAndCleanCorpse(false)
			}, 60000)
			})
	    } else {
		    // if not try again in 10 sec
			logger.warn('CCU does not respond. try again in 10 seconds')
		    setTimeout(function () {
			    that.checkCCUAlive()
		    }, 10000)
	    }
    })
}


HomematicLogicalLayer.prototype.pong = function(params) {
	if (params != undefined) {
	this.consumer.forEach(function (tc){
		var cid = tc.callbackid
		var eventPayload = []
			eventPayload.push({"methodName":"event","params":[cid ,'PONG',params[0]]})
			tc.methodCall("system.multicall", [eventPayload] , function(error, value) {
			
			})
		})
	}
}

HomematicLogicalLayer.prototype.ccuPing = function(callback) {

	this.runRegaScript('Write("PING");',function(result) {
		if (result) {
		  callback(true)
		} else {
		  callback(false)
		}
	})

}


HomematicLogicalLayer.prototype.checkAndCleanCorpse = function(cleaningMode) {
	var that = this

// Check devices on ccu which are not here anymore
	    logger.info('looking for corpses')

	    var corpses = that.getcorpsedCCUDevices(function(list){
		    if (list.length > 0) {
		    	logger.warn('corpsed devices : %s',JSON.stringify(list))
		    	if (cleaningMode == true) {
					// Build Rega to remove corpses
					logger.info('Auto Purge is set ... remove all corpses')
					that.removeCorpses(list)
				} 	    
		    } else {
			    logger.info('nothing found')
		    }
		})
}

HomematicLogicalLayer.prototype.autoDeleteDevice = function(adress) {
  if (this.config.getValue('auto_delete_non_existing_devices') == true) {
	  logger.info('Auto delete non existing device with adress %s',adress)
	  this.deleteDeviceWithAdress(adress)
  }
}

HomematicLogicalLayer.prototype.getLocalIpAdress = function() {
 return this.localip
}

HomematicLogicalLayer.prototype.addEventNotifier = function(callback) {
  	
  if (this.rpcEventServer==undefined) {
	var that = this	
	var port = 7002
	this.rpcEventServer = xmlrpc.createServer({
    host: that.localip,
    port: port
  	});
    var methods = {
   	'system.listMethods': function listMethods(err, params, callback) {
            callback(null,Object.keys(methods))
    },
    'listDevices': function listDevices(err, params, callback) {
      callback(null,[])
    },
    'newDevices': function newDevices(err, params, callback) {
      callback(null,[])
    },
    'event': function event(err, params, callback) {
      callback(null,[])
    },
    
    'system.multicall': function systemmulticall(err, params, callback) {
      that.lastrpcEvent = new Date()
	      params.map(function(events) {
        try {
          events.map(function(event) {
            if ((event["methodName"] === "event") && (event["params"] !== undefined)) {
              var params = event["params"]
              var intf = params[0]
              var strIf = ''
              if (intf.indexOf('hvl_')==0) {
	             strIf = intf.slice(4)
              }
              var channel = params[1]
              var datapoint = params[2]
              var value = params[3]
          	  logger.debug('RPC event (%s) for %s %s with value %s',strIf,channel,datapoint,value)
          	  that.doCache(strIf,channel,datapoint,value)
          	  try {
			  	  that.emit('ccu_datapointchange_event',strIf, channel,datapoint,value)
		  	  } catch (e){
			  	  logger.error('MultiCall Error %s',e.stack)
		  	  }
            }
          });
        } catch (err) {}
      });
      callback(null,[])
    } 
	};
    
    Object.keys(methods).forEach(function (m) {
           that.rpcEventServer.on(m, methods[m])
    })

    EventEmitter.call(this)

    this.addRPCClient('BidCos-RF');
    var callUrl = "http://" + that.localip + ':' + port
    logger.info("Init RPC Client for BidCos-RF with %s",callUrl)
    this.callRPCMethod('BidCos-RF','init', [callUrl , 'hvl_BidCos-RF' ], function(error, value) {
	  that.lastrpcEvent = new Date()
      logger.debug('CCU Response for ...Value (%s) Error : (%s)',JSON.stringify(value) , error)
	  if (callback) {
		  callback()
	  }
    });
	this.watchdog()
  } else {
	  if (callback) {
		  callback()
	  }
  }
    
}

HomematicLogicalLayer.prototype.watchdog = function() {
   var that = this
   var diff = new Date()-this.lastrpcEvent;
   logger.debug("RPC Watchdog last Message %s",diff)
   if (diff > this.maxRPCTimeOut) {
	   logger.warn ("RPC Message watchdog timeout -> reInit") 
		   Object.keys(that.rpcClients).forEach(function (intf) {
			   that.reInitRPCClient(intf);
		   })
	   that.lastrpcEvent = new Date()
   } 
   
   setTimeout(function() {
	   that.watchdog()
	   that.pong()
   }
   , 10000)
}


HomematicLogicalLayer.prototype.doCache = function(interf,adress,datapoint,value) {
  var adr = interf + '.' + adress + '.' + datapoint
  var el = this.CCUEventcache[adr]
  if (!el) {
	  el = {'v':value} 
  } else {
	  el['v'] = value
  }
  this.CCUEventcache[adr]=el
}

HomematicLogicalLayer.prototype.getCachedState = function(interf,adress,datapoint) {
	var adr = interf + '.' + adress + '.' + datapoint
	var dp = this.CCUEventcache[adr]
	return (dp) ? dp['v'] : undefined
}

HomematicLogicalLayer.prototype.reInitRPCClient = function(intf) {
    var port = 2001
    var that = this
	switch (intf) {
		  
		  case 'BidCos-RF':
		   port = 2001
		   break
		  case 'BidCos-Wired':
		   port = 2000
		   break
		  case 'HmIP-RF':
		   port = 2010
		   break
	 }


	this.callRPCMethod(intf,'init', ['http://' + this.localip + ':' + port , null ], function(error, value) {
      logger.debug('CCU Response close rcp ...Value (%s) Error : (%s)',JSON.stringify(value) , error);
      that.addRPCClient(intf);
    })


}


HomematicLogicalLayer.prototype.addRPCClient = function(intf) {
  if (this.rpcClient(intf) === undefined) {
	  
	  var port = 0
	  var path = '/'
	  var ccuIP = this.ccuIP
	  
	  switch (intf) {
		  
		  case 'BidCos-RF':
		   port = 2001
		   break
		  case 'BidCos-Wired':
		   port = 2000
		   break
		  case 'HmIP-RF':
		   port = 2010
		   break
	  }
	  
	var client = xmlrpc.createClient({
			host: ccuIP,
			port: port,
			path: path
	})
	logger.info("Creating RPC Client for %s",intf)
	this.rpcClients[intf] = client
	return client
  } else {
	return this.rpcClient(intf)
  } 
}




HomematicLogicalLayer.prototype.callRPCMethod = function(intf,command,parameters,callback) {
	var client = this.rpcClient(intf)
	if (client) {
		try {
			client.methodCall(command,parameters,function(error, value) {
			if (callback) {
				callback(error,value)
			}
		})
		} catch (e) {
			logger.error('RPC Error %s',e)
		}
	}
}

HomematicLogicalLayer.prototype.rpcClient = function(intf) {
 return this.rpcClients[intf]
}



HomematicLogicalLayer.prototype.isHMServer = function(intf) {
	return intf.indexOf('_java', intf.length - '_java'.length) !== -1
}

HomematicLogicalLayer.prototype.addConsumer = function(aConsumer) {
  // TODO Check if we have to purge old Consumers
  logger.debug('Adding new Consumer')
  this.consumer = this.removeOldConsumer(aConsumer)
  this.consumer.push(aConsumer)
}

HomematicLogicalLayer.prototype.saveConsumer = function() {
  // Encode
  var encoded = []
  this.consumer.map(function(consumer){
	  encoded.push(consumer.encode())
  })
  this.config.setPersistValue('consumer',JSON.stringify(encoded))
}

HomematicLogicalLayer.prototype.consumerWithID = function(cid) {
  var result = undefined
  this.consumer.forEach(function(aConsumer){
	  if (aConsumer.callbackid == cid) {
		  result = aConsumer
		  return
	  }
  })  
  return result
}

HomematicLogicalLayer.prototype.consumerWithHost = function(hostname) {
  var result = undefined
  this.consumer.forEach(function(aConsumer){
	  if (aConsumer.hostname == hostname) {
		  result = aConsumer
		  return
	  }
  })
  return result
}


HomematicLogicalLayer.prototype.cleanUp = function() {
	this.consumer = []
	this.saveConsumer()
	this.lastMessage = ''
}

HomematicLogicalLayer.prototype.removeOldConsumer = function(newconsumer) {
  var result =  this.consumer.filter(function(ctt) { return !ctt.isEqual(newconsumer); })
  logger.debug('Remove old consumer %s',JSON.stringify(this.consumer))
  return result
}

HomematicLogicalLayer.prototype.removeConsumer = function(consumer) {
  let index = this.consumer.indexOf(consumer)
  if (index > -1) {
    this.consumer.splice(index, 1);
  }
  logger.debug('remove consume %s',JSON.stringify(this.consumer))
}

HomematicLogicalLayer.prototype.loadConsumer = function(ccuip) {
  var that = this
  this.consumer = []
  var myccuip = ccuip
  
  var consumer = this.config.getPersistValue('consumer')
  try {
  if ((consumer) && (consumer!='undefined')) {
	  var oconsumer = JSON.parse(consumer)
	  if (oconsumer != undefined) {
	  
	  oconsumer.map(function(obj) {
	  		logger.info('init consumer %s',JSON.stringify(obj))
		    var cns = new RPCConsumer()
 			cns.initwithcoder(obj,myccuip)
 			that.addConsumer(cns)
	  });
	  }
  } else {
	  logger.info('No Consumer .. is this your first time ?')
  }
  
  } catch (e){
	  logger.error('Consumer Error %s',e)
  }
}

HomematicLogicalLayer.prototype.shutdown = function() {
	this.rpc_server.close()
	var port = 7002
	this.callRPCMethod('BidCos-RF','init', ['http://' + this.localip + ':' + port , null ], function(error, value) {
      logger.debug('CCU Response ...Value (%s) Error : (%s)',JSON.stringify(value) , error);
    })
	logger.debug('Virtual Layer Shutdown')
}


HomematicLogicalLayer.prototype.startMulticallEvent = function(timeout) {
  var that = this
  if (this.isCollectingMulticalls === false) {
	  this.isCollectingMulticalls = true
	  
	  if (timeout > 0) {
		  setTimeout(function(){
		  	  // If still collecting .. send pending events
			  if (this.isCollectingMulticalls == true) {
			  	logger.debug("Timeout send all events")
			  	that.sendMulticallEvents()		  
			  }
			  
		  }, timeout)
  	  }
  }
}


HomematicLogicalLayer.prototype.sendRPCEvent = function(adress,parameters) {
  var that = this
   this.consumer.forEach(function (tc){
		var eventPayload = []
		var cid = tc.callbackid
		 parameters.forEach(function (parameter) {
	     	var pValue
	     	if (parameter.type === 'FLOAT') {
		     	pValue = {"explicitDouble":parameter.value}
		    } else {
			    pValue = parameter.value
		    }	
		     
			if (that.isCollectingMulticalls == false) {
				tc.methodCall("event",[cid ,adress,parameter.name,pValue], function(error, value) {
			 		if ((error) && (tc.errorCount >= 10)) {
					 logger.info('Will remove Consumer %s cause of no responding',tc.hostname)
					 that.removeConsumer(tc)
					 that.saveConsumer()
			 	}
			 	})
			} else {
				// make sure we have the payload array
				if (tc.multicallPayload == undefined) {
					tc.multicallPayload = []
				}
				logger.debug("Saving event for a multicall later")
		 		tc.multicallPayload.push({"methodName":"event","params":[cid ,adress,parameter.name,pValue]})
			}
     	})
   })
}

HomematicLogicalLayer.prototype.sendMulticallEvents = function() {
   var that = this;
   logger.debug("sending all saved events")
   this.consumer.forEach(function (tc){
	    if (tc.multicallPayload.length > 0) {
			logger.debug('Queuesize for %s is %s',tc.callbackid,tc.multicallPayload.length)
			tc.methodCall("system.multicall", [tc.multicallPayload], function(error, value) {
	 		 tc.multicallPayload = [] // clean 
	 		 if ((error) && (tc.errorCount >= 10)) {
				 logger.info('Will remove Consumer %s cause of no responding',tc.hostname)
				 that.removeConsumer(tc)
				 that.saveConsumer()
			 }
		 	})
		} else {
			logger.debug('Skipping %s empty queue (%s)',tc.callbackid,tc.multicallPayload.length)
		}
     })
	that.isCollectingMulticalls = false
}

HomematicLogicalLayer.prototype.getMyDevices = function() {
      var result = []
      var that = this
      this.devices.some(function (device) {
	    // Check if there is a deletion flag
	    if (!that.wasDeletedBefore(device)) {
	    	if (device.hidden == false) {
		    	result.push(device.getDeviceDescription())
				device.channels.forEach(function (channel) {
					result.push(channel.getChannelDescription())
				})	
	    	}
	    }
	  })
     return result
}


HomematicLogicalLayer.prototype.publishAllDevices = function(callback) {
	var that = this
	this.sendRPCMessage(undefined,'newDevices',this.getMyDevices(), function(error, value) {
		that.devices.forEach(function (device) {
			if (device.hidden == false) {
				device.wasPublished = true
				that.saveDevice(device)
			}
		})
		callback()
	})
}

HomematicLogicalLayer.prototype.sendRPCMessage = function(consumerID, method,payload,callback) {
  
  if (consumerID == undefined) {
	  // send to all
    logger.debug('Will send to all Consumers')
	this.consumer.forEach( function(aConsumer){
	    if (aConsumer.path != '/bidcos') {
	    aConsumer.methodCall(method, [aConsumer.callbackid,payload] , function(error, value) {
    				logger.debug('RPC %s Response %s Errors: %s',method,JSON.stringify(payload),error);
    				if (callback!=undefined) {
    				  callback(error,value)
    				}
    	})
    	} else {
	    	logger.info('Skip HMServer')
    	}
	})
  } else {
    var consumer = this.consumerWithID(consumerID);
    if (consumer != undefined) {
	    consumer.methodCall(method, [consumerID,payload] , function(error, value) {
    				logger.debug('RPC %s Response %s Errors: %s',method,JSON.stringify(payload),error)
    				if (callback!=undefined) {
    				  callback(error,value)
    				}
    	});
    }
 }
}

HomematicLogicalLayer.prototype.addDevice = function(device,save,hidden) {
   logger.debug('Add new Device to HomematicLogicLayer %s', device.adress);
   device.hidden = hidden || false;
   device.interfaceName = this.ccuInterfaceName || 'HVL';
   logger.debug("List contains %s items",this.devices.length)
   this.devices.push(device);
   logger.debug("Pushed to list %s",device.hidden);
   logger.debug("List contains %s items",this.devices.length)
   var that = this;
   
   if (!hidden) {
   	// Add Listener to Working Events to publish
   		device.on("event_device_channel_value_change", function(parameter){
		 logger.debug("Device Value Change Event for %s",parameter.channel);
		 that.sendRPCEvent(parameter.channel,parameter.parameters);
		});
   }
   
  
   
   if ((!device.wasPublished) && (!device.hidden)) {
   		logger.debug("Send this to CCU");
   		var result = [];
   		result.push(device.getDeviceDescription())
	    
   		device.channels.forEach(function (channel) {
	    	 result.push(channel.getChannelDescription())
  		});
   
  		this.sendRPCMessage(undefined,"newDevices",result, function(error, value) {
	  		device.wasPublished = true;
	  		if (save) {that.saveDevice(device);}
    	});
    	
   } else {
	  logger.debug("CCU should (not) know about %s",device.adress);
      if (save) {this.saveDevice(device);}
   }
   
}

HomematicLogicalLayer.prototype.initDevice = function(pluginName, serial,type) {
  return this.initDevice(pluginName, serial,type,serial)
}


HomematicLogicalLayer.prototype.initDevice = function(pluginName, serial,type,hmSerial) {
  var device = new HomematicDevice(pluginName)
  // first check if we have stored data
  
  var data = this.deviceDataWithSerial(serial)
  if (data != undefined) {
  // if there is a persistent file with data create the device from that data
	device.initWithStoredData(data)
  } 
  
  if (device.initialized === false) {
	  // if not build a new device from template
	  device.initWithType(type,hmSerial)
	  device.serialNumber = serial
	  this.addDevice(device,true)
  } else {
      // device was initalized from persistent data just add it to the interface
	  this.addDevice(device,false)
  }
  
  return device
}


HomematicLogicalLayer.prototype.deviceDataWithSerial = function(serial) {
  var persistenceFile = this.config.storagePath() + "/" + serial + ".dev";
  try {
    var data = fs.readFileSync(persistenceFile);
    // Try to parse //
	    JSON.parse(data);
    return data;
  } catch (e) {
    return undefined;
  }
}

HomematicLogicalLayer.prototype.wasDeletedBefore = function(device) {
	var result = false
	var deletedDevices = this.config.getPersistValueWithDefault("deletedDevices",[]);
	if (deletedDevices)  {
		deletedDevices.some(function (adress){
			if (device.adress===adress) {
				result = true;
			}
		})
	}
	
	return result
}


HomematicLogicalLayer.prototype.saveDevice = function(device) {
   var persistenceFile = this.config.storagePath() + "/" + device.serialNumber + ".dev";
   logger.debug("make device %s persistent at %s",device.serialNumber,persistenceFile);
   fs.writeFile(persistenceFile, device.savePersistent(), function(err) {});
}

HomematicLogicalLayer.prototype.removeStoredDeviceDataWithSerial = function(serialNumber) {
   var persistenceFile = this.config.storagePath() + "/" + serialNumber + ".dev";
   try {
     fs.unlinkSync(persistenceFile);
   } catch (err) {}
}


HomematicLogicalLayer.prototype.removeStoredDeviceData = function(device) {
   var persistenceFile = this.config.storagePath() + "/" + device.serialNumber + ".dev";
   try {
     fs.unlinkSync(persistenceFile);
   } catch (err) {}
}


HomematicLogicalLayer.prototype.deviceWithAdress = function(adress) {
	
	var result = undefined;
	
	this.devices.forEach(function (device) {
		if (device.adress === adress) {
			result = device;
		}
		});
	
	return result;
}


HomematicLogicalLayer.prototype.logVirtualChannels = function() {
  var that = this;
  this.devices.forEach(function (device) {
	  logger.debug("Device %s",device.adress)
	  device.channels.forEach( function(channel) {
		  logger.debug("Channel %s",channel.adress)
	  })
  })
}

HomematicLogicalLayer.prototype.channelWithAdress = function(adress) {
	var deviceAdress = adress.slice(0,adress.indexOf(":"));
	var selectedDevice = this.devices.filter(function (device) { return device.adress == deviceAdress}).pop();
	
	if (selectedDevice) {
		var selChannel =  selectedDevice.channels.filter(function (channel) { return channel.adress == adress}).pop();
		return selChannel;
		
	}
	return undefined;
}

HomematicLogicalLayer.prototype.devicesWithNameLike = function(name) {
	
	var result = [];
	var re = new RegExp("^"+name+"*.?");
	
	this.devices.forEach(function (device) {
		if (re.test(device.adress)) {
			result.push(device);
		}
		});
	return result;
}


HomematicLogicalLayer.prototype.deleteDevice = function(device,publish) {
   logger.debug("Remove Device from HomematicLogicLayer %s" , device.adress)
   var index = this.devices.indexOf(device)
   if (index > -1) {
    this.devices.splice(index, 1)
	// Remove persistence    
     var persistenceFile = this.config.storagePath() + '/' + device.serialNumber + '.dev'
     try {
	     if (fs.existsSync(persistenceFile)) {
		     fs.unlinkSync(persistenceFile)
	     }
		 var deltedDevices = this.config.getPersistValueWithDefault('deletedDevices',[])
		 deltedDevices.push(device.adress)
		 this.config.setPersistValue('deletedDevices',deltedDevices)
     } catch (err) {
	     logger.error('delete device error %s',err)
     }
     // Send that to all consumers
     if (publish == true) {
	    this.sendRPCMessage(undefined,'deleteDevices',[device.adress], function(error, value) {})
     }
     
   }
}


HomematicLogicalLayer.prototype.deleteDevicesByOwner = function(device_owner) {
  var that = this;
  logger.debug("deleteDevicesByOwner %s" , device_owner)
  this.devices.some(function (device){
	if ((device.owner) && (device.owner === device_owner)) {
	   that.deleteDeviceTemporary(device)
	}
  })
}


HomematicLogicalLayer.prototype.deleteDeviceWithAdress = function(adress) {
   logger.debug('Remove Device Rega %s', adress)
   this.sendRPCMessage(undefined,'deleteDevices',[adress], function(error, value) {})
}

HomematicLogicalLayer.prototype.deleteDeviceTemporary = function(device) {
   logger.debug('temporary Remove Device from HomematicLogicLayer %s', device.adress)
   var index = this.devices.indexOf(device)
   if (index > -1) {
    this.devices.splice(index, 1)
   }
}

HomematicLogicalLayer.prototype.runRegaScript = function(script,callback) {
    new regaRequest(this,script,function(result){
	  if (callback) {callback(result)}
	})
}

HomematicLogicalLayer.prototype.loadCCUProgramms = function(callback) {
    var that = this
    var result_list = {}
    var script = "string pid;boolean df = true;Write(\'{\"programs\":[\');foreach(pid, dom.GetObject(ID_PROGRAMS).EnumUsedIDs()){var prg = dom.GetObject(pid);if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\' # pid # \'\",\"name\": \"\' # prg.Name() # \'\"}\');}Write(\"]}\");\";"
    
    new regaRequest(this,script,function(result){
	    
	    try {
		    if (result) {
		    	var jobj = JSON.parse(result);
				callback(jobj)
			}  
	    } catch (e) {
		    logger.error(e.stack)
	    }
    })
}

HomematicLogicalLayer.prototype.loadCCUVariables = function(callback) {
    var that = this
    var result_list = {}
    var script = "string pid;boolean df = true;Write(\'{\"variables\":[\');foreach(pid, dom.GetObject(ID_SYSTEM_VARIABLES).EnumUsedIDs()){var vrb = dom.GetObject(pid);if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\' # pid # \'\",\"name\": \"\' # vrb.Name() # \'\" ,\"type\": \"\' # vrb.ValueType() # \'\" ,\"subtype\": \"\' # vrb.ValueSubType() # \'\"    }\');} Write(\"]}\");\";"
    
    new regaRequest(this,script,function(result){
	    
	    try {
		    if (result) {
		    	var jobj = JSON.parse(result);
				callback(jobj)
			}  
	    } catch (e) {
		    logger.error(e.stack);
	    }
    })
}

HomematicLogicalLayer.prototype.loadCCUDevices = function(interfaces, callback) {
    var that = this;
    
    var ifSelector = "(oInterface.Name() == 'BidCos-RF')";
    
    if (interfaces.indexOf('BidCos-Wired')>-1) {
	    ifSelector = ifSelector + " || (oInterface.Name() == 'BidCos-Wired')"
    }

    if (interfaces.indexOf('HmIP-RF')>-1) {
	    ifSelector = ifSelector + " || (oInterface.Name() == 'HmIP-RF')"
    }
    
    
    var script = "string sDeviceId;string sChannelId;boolean df = true;Write(\'{\"devices\":[\');foreach(sDeviceId, root.Devices().EnumIDs()){object oDevice = dom.GetObject(sDeviceId);if(oDevice){var oInterface = dom.GetObject(oDevice.Interface());if (" + ifSelector + ") { if(df) {df = false;} else { Write(\',\');}Write(\'{\');Write(\'\"id\": \"\' # sDeviceId # \'\",\');Write(\'\"if\": \"\' # oInterface # \'\",\');Write(\'\"name\": \"\' # oDevice.Name() # \'\",\');Write(\'\"address\": \"\' # oDevice.Address() # \'\",\');Write(\'\"type\": \"\' # oDevice.HssType() # \'\",\');Write(\'\"channels\": [\');boolean bcf = true;foreach(sChannelId, oDevice.Channels().EnumIDs()){object oChannel = dom.GetObject(sChannelId);if(bcf) {bcf = false;} else {Write(\',\');}Write(\'{\');Write(\'\"cId\": \' # sChannelId # \',\');Write(\'\"name\": \"\' # oChannel.Name() # \'\",\');if(oInterface){Write(\'\"intf\": \"\' # oInterface.Name() 	# \'\",\');Write(\'\"address\": \"\' # oInterface.Name() #\'.'\ # oChannel.Address() # \'\",\');}Write(\'\"type\": \"\' # oChannel.HssType() # \'\"\');Write(\'}\');}Write(\']}\');}}}Write(\']}\');"
    
    new regaRequest(this,script,function(result){
	    
	    try {
		    if (result) {
		    	var jobj = JSON.parse(result)
				callback(jobj)
			}
		} catch (error) {
			
		}
    });
}

HomematicLogicalLayer.prototype.getCcuInterfaceName = function() {
	return this.ccuInterfaceName
}

HomematicLogicalLayer.prototype.getmyInterfaceNameOnCCU = function(host,port,callback) {

logger.debug('trying to get my name for interface at %s:%s',host,port)

var rega = "string stdout;string stderr;string cmd;cmd = 'cat /usr/local/etc/config/InterfacesList.xml';system.Exec(cmd, &stdout, &stderr);WriteLine(stdout);"
var xml2js = require('xml2js'),parser = new xml2js.Parser()
var that = this
this.ccuInterfaceFound = false

new regaRequest(this,rega,function(result){
    parser.parseString(result, function (err, xmlresult) {
      if (xmlresult) {
	      var ipc = xmlresult['interfaces']['ipc']
	      if (ipc) {
		      ipc.some(function (ipcelement){
			      if (ipcelement.url[0].toLowerCase().indexOf("xmlrpc://"+host+":"+port)>-1) {
				      logger.info("My Interface Name at your CCU is %s",ipcelement.name[0])
				      that.ccuInterfaceName = ipcelement.name[0]
				      that.ccuInterfaceFound = true
				      if (callback) {
					      callback(ipcelement.name[0])
				      }
			      }
		      })
		      
	      } else {
		      logger.error('Cannot fetch my Name from CCU .. %s',JSON.stringify(xmlresult[0]))
	      }
      }
    });
});

}


HomematicLogicalLayer.prototype.getMyDevicesAtCCU = function(callback) {
	
 if ((this.ccuInterfaceFound === true) && (this.ccuInterfaceName)) {
	
	var rega = "var ifId = dom.GetObject(ID_INTERFACES).GetObject(\'" + this.ccuInterfaceName + "\').ID();string sDeviceId;boolean df = true;Write(\'{\"devices\":[\');foreach(sDeviceId, root.Devices().EnumIDs()) {var dObj = dom.GetObject(sDeviceId);if (dObj.Interface() == ifId) {if(df) {df = false;} else { Write(\',\');}Write(\'{\"adr\":\"\');Write(dObj.Address());Write(\'\",\"rId\":\"\');Write(sDeviceId);Write(\'\"}\');}}Write(\']}\');"

	new regaRequest(this,rega,function(result){
		try {
		    if (result) {
		    	var jobj = JSON.parse(result)
				callback(jobj)
			}
		} catch (error) {
		    logger.error('Cannot parse ccu response for myDevices %s (%s)',result,error)	
		}
				
	})
 } else {
	 callback(undefined)
 }
}

HomematicLogicalLayer.prototype.getDeviceOwner = function(device) {
  let ownerName = device.owner
  if (ownerName != undefined) {
	  return this.hvlserver.pluginWithName(ownerName)
  }
  return undefined
}

HomematicLogicalLayer.prototype.getcorpsedCCUDevices = function(callback) {
  var result = []
  let that = this
  
  this.getMyDevicesAtCCU(function(deviceList){
	  
	  if (deviceList) {
		  deviceList.devices.some(function(corpse){
			 if (that.deviceWithAdress(corpse.adr)==undefined) {
				 result.push({'address':corpse.adr,'regaid':corpse.rId})
			 } 
		  })
	  }
	  
      callback(result)	  
  })

}

HomematicLogicalLayer.prototype.removeCorpses = function(list,callback) {

  var rega = ""
  list.some(function(corpse){
	  rega = rega + "dom.DeleteObject(" +  corpse.regaid + ");"
  })
  rega = rega + "WriteLine(\"Done removing corpses\");"
  logger.debug("Clean Rega %s",rega)
  new regaRequest(this,rega,function(result){
	  logger.info(result)
	  callback()
  })
}

HomematicLogicalLayer.prototype.listConsumer = function() {
 return this.consumer
}

module.exports = {
  HomematicLogicalLayer : HomematicLogicalLayer
}
