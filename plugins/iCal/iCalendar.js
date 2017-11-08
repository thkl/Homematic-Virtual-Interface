'use strict'
var moment = require('moment')
var uuid = require('uuid')

var iCalendar = function(plugin, url, itemCount, serialprefix) {


		var that = this
		this.log = plugin.log
		this.bridge = plugin.server.getBridge()
		this.plugin = plugin
		this.url = url
		this.itemCount = itemCount
		this.prefix = serialprefix
		this.uuid = uuid.v1();

		this.checkVariables()
		this.refresh()
		
		
}

iCalendar.prototype.checkVariables = function() {
	
	let tmpscript = "object x = dom.GetObject(ID_SYSTEM_VARIABLES).Get('%vn%');if (!x){object newVar = dom.CreateObject(OT_VARDP); newVar.Name('%vn%');newVar.ValueType(%vt%);newVar.ValueSubType(%vs%);dom.GetObject(ID_SYSTEM_VARIABLES).Add(newVar.ID());}"

	var regaScript = ""
	
	for(var i=0; i<this.itemCount; i++){	
		
	   var script = tmpscript
	   script = script.replace(/%vn%/gi, this.prefix + "_" + i + "_Date")
	   script = script.replace(/%vt%/gi, "ivtString")
	   script = script.replace(/%vs%/gi, "istChar8859")
	   regaScript = regaScript + script	   

	   var script = tmpscript
	   script = script.replace(/%vn%/gi, this.prefix + "_" + i + "_Desc")
	   script = script.replace(/%vt%/gi, "ivtString")
	   script = script.replace(/%vs%/gi, "istChar8859")
	   regaScript = regaScript + script	   

	   var script = tmpscript
	   script = script.replace(/%vn%/gi, this.prefix + "_" + i + "_Diff")
	   script = script.replace(/%vt%/gi, "ivtFloat")
	   script = script.replace(/%vs%/gi, "istGeneric")

	   var script = tmpscript
	   script = script.replace(/%vn%/gi, this.prefix + "_" + i + "_User")
	   script = script.replace(/%vt%/gi, "ivtString")
	   script = script.replace(/%vs%/gi, "istChar8859")
	   regaScript = regaScript + script	   


	   regaScript = regaScript + script	   
	   
	}
	this.bridge.runRegaScript(regaScript,function(result){})
}

iCalendar.prototype.refresh = function() {

	var ical = require('ical')
	var items = []
	var that = this			
	var today = new Date();
	today.setHours(0,0,0,-1);
	let mNow = moment(new Date());
	ical.fromURL(this.url, {}, function(err, data) {
      
      for (var k in data){
        if (data.hasOwnProperty(k)) {
	        var ev = data[k]
	        // Check if date is not in the past
			if (ev.start > today) {
		        items.push(ev)
			}
        }
      }
      
      items.sort(function(a,b){
	  	return  new Date(a.start)-new Date(b.start);
	  });
	  var cnt = 0
	  var script = ""
	  items.some(function (event){
		if (that.itemCount > cnt) {
			// Fill Variables
			let start = moment(event.start)
			let strDate = start.format("D.MM.YYYY HH:mm:ss")
			let strUser = (that.plugin.userFormat != undefined) ? start.format(that.plugin.userFormat) : ''
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_Date').State('" + strDate + "');"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt +  "_Desc').State('" + event.summary + "');"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_Diff').State(" + start.diff(mNow,'seconds') + ");"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_User').State('" + strUser + "');"
			cnt = cnt + 1
		}
	  })

// fill others with zero
	  while (that.itemCount > cnt) {
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_Date').State('');"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt +  "_Desc').State('');"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_Diff').State(0);"
			script = script + "dom.GetObject(ID_SYSTEM_VARIABLES).Get('" + that.prefix + '_' + cnt + "_User').State('');"
			cnt = cnt + 1
	  }

	 that.bridge.runRegaScript(script,function(result){})
    });
    // wait 30 minutes
    setTimeout(function(){
	    that.refresh()
    }, 1800000)
}

module.exports = {
  iCalendar : iCalendar
}