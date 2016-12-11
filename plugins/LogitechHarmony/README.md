# Homematic-Virtual-Interface Harmony Plugin


* provides a Harmony Client to map all activities into a HM Remote
* provides a transparent HUE Bridge for fake lights which are mapped as dimmer or switch to your ccu. you can control theese devices via your remote

 ```
 {
    "type":"LogitechHarmony",
    "name":"Harmony",
    "port":7001,
    "hue_plugin_name":"HueMain",
    "hub_ip":"192.168.foobar"
}
 ```
 
 If you got a real HUE Bridge, setup the hue_plugin_name to the name of the hue plugin of this layer. So all your lights will also be mapped. This is because the Harmony Hub can only handle on HUE Bridge.