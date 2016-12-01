	"use strict";

var HomematicDevice;

var LightifyDevice = function(plugin, api ,light,serialprefix) {


		var that = this;
		this.api =  api;
		this.log = plugin.log;
		this.bridge = plugin.server.getBridge();
		
		HomematicDevice = plugin.server.homematicDevice;
		
		this.mac = light["mac"];
		this.onTime = 0;
		this.lastLevel = 0;

		this.log.debug("Setup new LightifyDevice %s",serialprefix);
		this.transitiontime = 4;

		this.hmDevice = new HomematicDevice("HM-LC-RGBW-WM", serialprefix);
		this.hmDevice.firmware = light["firmware_version"];
		this.bridge.addDevice(this.hmDevice);

		this.hmDevice.on('device_channel_value_change', function(parameter){
			
			that.log.debug("Value was changed " + JSON.stringify(parameter) );
			var newValue = parameter.newValue;
			
			var channel = that.hmDevice.getChannel(parameter.channel);

			if (parameter.name == "INSTALL_TEST") {
				
				channel.endUpdating("INSTALL_TEST");
	      	}


	      if (parameter.name == "LEVEL") {
	       that.setLevel(newValue);
		   if ((that.onTime > 0) && (newValue>0)) {
		    setTimeout(function() {that.setLevel(0);}, that.onTime * 1000);
	       }
	       // reset the transition and on time 
	       that.transitiontime = 4;
	       that.onTime = 0;
	       if (newValue > 0) {
		       that.lastLevel = newValue;
	       }
	     }


		 if (parameter.name == "OLD_LEVEL") {
	       if (newValue==true) {
		      if (that.lastLevel == 0) {
			      that.lastLevel = 1;
		      }
		      that.setLevel(that.lastLevel); 
	       
	       }
	       
	     }

	    if ((parameter.name == "RAMP_TIME") && (channel.index == "1")) {
		  that.transitiontime = newValue*10;
		}

	    if ((parameter.name == "ON_TIME") && (channel.index == "1")) {
		  that.onTime = newValue;
		}


	    if (parameter.name == "COLOR") {
		  that.setColor(newValue);
		  that.transitiontime = 4;
	     }


	    if (parameter.name == "SATURATION") {
		  that.setSaturation(newValue);
	     }




	    });

	     this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 1000);

	}
	
	

	LightifyDevice.prototype.setColor = function(newColor) {
		var that = this;
		
	    var co_channel = that.hmDevice.getChannelWithTypeAndIndex("RGBW_COLOR","2");

		if (co_channel != undefined) {
	        co_channel.startUpdating("COLOR");
		}

		if (newColor==200) {
			this.api.node_color(this.mac,255,255,255,1,this.transitiontime);
		} else {
			var rgb=this.HSVtoRGB(newColor/199,1,1);
			this.api.node_color(this.mac,rgb.r,rgb.g,rgb.b,1,this.transitiontime);
		}
	    co_channel.endUpdating("COLOR");
	}



	LightifyDevice.prototype.setLevel = function(newLevel) {
	    var that = this;
	    var di_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
		di_channel.startUpdating("LEVEL");
		di_channel.updateValue("LEVEL",newLevel);
		this.api.node_brightness(this.mac,newLevel*100, this.transitiontime);
		di_channel.endUpdating("LEVEL");
	}

	LightifyDevice.prototype.refreshDevice = function(device) {
	  var that = this;
	  
	  this.api.get_status(this.mac).then(function(data) {
		  that.log.debug(data);
		  if ((data != undefined) && (data.result != undefined)) {
		  	  var di_channel = that.hmDevice.getChannelWithTypeAndIndex("DIMMER","1");
		  	  that.log.debug("Query Reslut %s",JSON.stringify(data["result"][0]["brightness"]));
			  var bri = data["result"][0]["brightness"] / 100;
			  that.log.debug("Set Osram Level to %s",bri);
			  di_channel.updateValue("LEVEL",bri,true);
			  
			  var r = data["result"][0]["red"];
			  var g = data["result"][0]["green"];
			  var b = data["result"][0]["blue"];

		  	  var co_channel = that.hmDevice.getChannelWithTypeAndIndex("RGBW_COLOR","2");
				
			  if ((r == 255) && (g == 255 ) && ( b == 255 )) {
				  that.log.debug("Spezial 200");
				  co_channel.updateValue("COLOR",200,true);
			  } else {
				  var hsv = that.RGBtoHSV(r,g,b);
				  var hue = (hsv.h * 199)
				  co_channel.updateValue("COLOR",hue,true);
			  }			  
		  }

	  });
	

	 this.updateTimer = setTimeout(function() {
		 	that.refreshDevice();
		 }, 60000);
	}


LightifyDevice.prototype.RGBtoHSV=function(r, g, b) {
    if (arguments.length === 1) {
        g = r.g, b = r.b, r = r.r;
    }
    var max = Math.max(r, g, b), min = Math.min(r, g, b),
        d = max - min,
        h,
        s = (max === 0 ? 0 : d / max),
        v = max / 255;

    switch (max) {
        case min: h = 0; break;
        case r: h = (g - b) + d * (g < b ? 6: 0); h /= 6 * d; break;
        case g: h = (b - r) + d * 2; h /= 6 * d; break;
        case b: h = (r - g) + d * 4; h /= 6 * d; break;
    }

    return {
        h: h,
        s: s,
        v: v
    };
}

	LightifyDevice.prototype.HSVtoRGB = function(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
	}

	module.exports = {
	  LightifyDevice : LightifyDevice
	}
