# Homematic-Virtual-Interface Pioneer Plugin

This plugin creates a 19Key Remote for your Pioneer AVR

The Keys are :
Channel 1 : Power ON
Channel 2 : Power OFF
Channel 3 : Volume Up
Channel 4 : Volume Dn
Channel 5 : Mute

You may Configure the other Channels via WebGUI. There is a Parameter CMD_PRESS_SHORT where you can put in the Codes to do other actions . see your manual.

In Config.json please setup the host and port

{
      "type": "PioneerAVR",
      "name": "Pioneer",
      "options" : {
	  	"host":"192.168......",
	  	"port":23
	  	}
}