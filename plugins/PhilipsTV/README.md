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
 If you switch Off the Actor (Level < 100%), the Ambilight will switched off also, Switching ON the Actor (100%) the Ambilight will swt to automatic mode.
 You may also choose a Color.
