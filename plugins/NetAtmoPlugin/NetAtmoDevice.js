
var HomematicDevice;

var NetAtmoDevice = function(plugin, netAtmoApi ,naDevice,serialprefix) {
	this.name = naDevice["station_name"];
}



NetAtmoDevice.prototype.refreshDevice = function() {

}


NetAtmoDevice.prototype.parseModuleData = function (measurement,channel) {
	
}



// calculations from https://www.wetterochs.de/wetter/feuchte.html
NetAtmoDevice.prototype.saturation_vapor_pressure =  function(temperature)
{
	var a, b;
	if(temperature >= 0)
	{
		a = 7.5;
		b = 237.3;
	}
	else
	{
		a = 7.6;
		b = 240.7;
	}

	var saturation_vapor_pressure = 6.1078 * Math.exp(((a*temperature)/(b+temperature))/Math.LOG10E);

	return saturation_vapor_pressure;
}

NetAtmoDevice.prototype.vapor_pressure =   function (temperature, relative_humidity)
{
	var saturation_vapor_pressure = this.saturation_vapor_pressure(temperature);
	var vapor_pressure = relative_humidity/100 * saturation_vapor_pressure;
	return vapor_pressure;
}


NetAtmoDevice.prototype.dew_point =  function (temperature, relative_humidity)
{
	var vapor_pressure = this.vapor_pressure(temperature, relative_humidity);
	var a, b;

	if(temperature >= 0)
	{
		a = 7.5;
		b = 237.3;
	}
	else
	{
		a = 7.6;
		b = 240.7;
	}
	var c = Math.log(vapor_pressure/6.1078) * Math.LOG10E;
	var dew_point = (b * c) / (a - c);
	return dew_point;
}

NetAtmoDevice.prototype.absolute_humidity = function (temperature, relative_humidity) {
	var mw = 18.016;
	var r_star = 8314.3;
	var vapor_pressure = 100 * this.vapor_pressure(temperature, relative_humidity);
	var absolute_humidity = 1000 * mw/r_star * vapor_pressure/this.CelsiusToKelvin(temperature);
	return absolute_humidity;
}

NetAtmoDevice.prototype.CelsiusToKelvin = function (temperature)
{
	return temperature + 273.15;
}

module.exports = {
	  NetAtmoDevice : NetAtmoDevice
}
