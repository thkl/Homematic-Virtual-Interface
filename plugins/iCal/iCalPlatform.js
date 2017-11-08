'use strict'

const path = require('path')
const fs = require('fs')
var appRoot = path.dirname(require.main.filename)
if (appRoot.endsWith('bin')) { appRoot = appRoot + '/../lib' }

if (appRoot.endsWith('node_modules/daemonize2/lib')) { 
	appRoot = path.join(appRoot,'..','..','..','lib')
	
	if (!fs.existsSync(path.join(appRoot,'HomematicVirtualPlatform.js'))) {
	   appRoot = path.join(path.dirname(require.main.filename),'..','..','..','node_modules','homematic-virtual-interface','lib')
	}
}

appRoot = path.normalize(appRoot);

var HomematicVirtualPlatform = require(appRoot + '/HomematicVirtualPlatform.js')

var util = require('util')
var HomematicDevice
var url = require('url')
var iCalendar = require(path.join(__dirname,'iCalendar.js')).iCalendar

function iCalPlatform (plugin, name, server, log, instance) {
  iCalPlatform.super_.apply(this, arguments)
  HomematicDevice = server.homematicDevice
}

util.inherits(iCalPlatform, HomematicVirtualPlatform)

iCalPlatform.prototype.init = function () {
  var that = this
  this.reInit()
  this.plugin.initialized = true
  this.log.info('initialization completed %s', this.plugin.initialized)
}

iCalPlatform.prototype.reInit = function() {
  this.cals = []
  var that = this
  this.userFormat = this.config.getValueForPluginWithDefault(this.name,"userFormat",undefined);
  var calendars  = this.config.getValueForPluginWithDefault(this.name,"calendars",[]);
  calendars.some(function(calendar) {
	var cal = new iCalendar(that, calendar.url, calendar.itemCount, calendar.prefix)	  
	that.cals.push(cal)
  })
}

iCalPlatform.prototype.saveCalendars = function() {

 var cts = []
 this.cals.some(function(calendar) {
   cts.push({"url":calendar.url,"itemCount":calendar.itemCount,"prefix":calendar.prefix})
 })
 
 this.config.setValueForPlugin(this.name,"calendars",cts); 
}



iCalPlatform.prototype.calendarWithUUid = function(uuid) {
  var result = undefined
  this.cals.some(function(calendar) {
	  if (calendar.uuid == uuid) {
		  result = calendar
	  }
  })
  
  return result;
}

iCalPlatform.prototype.showSettings = function(dispatched_request) {
	var result = [];
	result.push({"control":"text","name":"userFormat","label":"User TimeFormat","value":this.userFormat,"description":"Format String for user time field see https://momentjs.com/docs/#/displaying/format/"});
	return result;
}

iCalPlatform.prototype.saveSettings = function(settings) {
	var that = this
	var userFormat = settings.userFormat;

	if (userFormat) {
		this.userFormat = userFormat
		this.config.setValueForPlugin(this.name,"userFormat",userFormat); 
	}
	this.reInit()
}




iCalPlatform.prototype.showCalendars = function (dispatchedRequest) {
  var calList = ""
  var calendar_template = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_calendar.html",null);
  this.cals.some(function(cal){
		calList = calList + dispatchedRequest.fillTemplate(calendar_template,{"calendar.prefix":cal.prefix,
																				  "calendar.url":cal.url,
  																			   	    "calendar.icount":cal.itemCount,
  																			   	    "calendar.uuid":cal.uuid,
  																			   	    });
  })
  return calList
}

iCalPlatform.prototype.handleConfigurationRequest = function (dispatchedRequest) {
  var template = 'index.html'
  var requesturl = dispatchedRequest.request.url
  var queryObject = url.parse(requesturl, true).query
  var deviceList = ''
  if (queryObject['do'] !== undefined) {
    
    switch (queryObject['do']) {


	  case 'edit' : 
	  {
		let template = dispatchedRequest.getTemplate(this.plugin.pluginPath , "list_calendar_edit.html",null);
		let uuid = queryObject['uuid']
		let cal =  this.calendarWithUUid(uuid)
		if (cal != undefined) {
  			deviceList = dispatchedRequest.fillTemplate(template,{"calendar.prefix":cal.prefix,
																				  "calendar.url":cal.url,
  																			   	    "calendar.icount":cal.itemCount,
  																			   	    "calendar.uuid":cal.uuid,
  																			   	    });
  		} else {
			deviceList = dispatchedRequest.fillTemplate(template,{"calendar.prefix":"Name",
																				  "calendar.url":"",
  																			   	    "calendar.icount":"5",
  																			   	    "calendar.uuid":"new",
  																			   	    });
		}
	  }	  
	  break


      case 'app.js':
        {
          template = 'app.js'
        }
        break

    }
  } else 
  
  if (dispatchedRequest.post != undefined) {

	    switch (dispatchedRequest.post["do"]) {
		    case 'save' : 
			{
				this.log.debug("saving")
				let uuid = dispatchedRequest.post['uuid']
				let prefix = dispatchedRequest.post['calendar.prefix']
				let url = dispatchedRequest.post['calendar.url']
				let itemCount = dispatchedRequest.post['calendar.icount']
				let cal =  this.calendarWithUUid(uuid)
				if (cal != undefined) {
					cal.url = url
					cal.prefix = prefix
					cal.itemCount = itemCount
				} else {
					var ncal = new iCalendar(this, url, itemCount, prefix)
					this.cals.push(ncal)
						
				}
				this.saveCalendars()
				this.reInit()
				deviceList = this.showCalendars(dispatchedRequest)
			}
			
						break
	    }
   }
    
   else {
	  deviceList = this.showCalendars(dispatchedRequest)
	}

  dispatchedRequest.dispatchFile(this.plugin.pluginPath, template, {'listDevices': deviceList})
}

module.exports = iCalPlatform
