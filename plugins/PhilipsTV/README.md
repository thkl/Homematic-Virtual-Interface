# Homematic-Virtual-Interface  - Hue Plugin
Add your Philips TV Ambilight as RGB Device to your CCU

config :

 ```
{
      "type": "PhilipsTV",
      "name": "Philips TV Ambilight",
      "tv_ip": "192.168.xx.xx"
}
    
 ```
 
 The TV has to switched on while the plugin is initializing. Otherwise the API ID cannot be fetched from the TV.

You can setup the Ambilight if the TV is on using the Dimmer and RGB settings.
You can switch to loung-mode by set the automatic program of the RGB Device to slow cycle.
You can switch back to internal mode (Ambilight controled by tv image) by set the automatic program to "TV-Simmulation"