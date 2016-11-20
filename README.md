# Homematic-Hue-Interface
Add your HUE Lamps as a RGBW Device to HM


This is work in progress.


Configuration:

fill the config.json ....


Start:

npm start



add the service to /etc/config_templates/InterfacesList.xml  at your ccu

 ```
 <ipc>
    <name>HmHue</name>
    <url>xmlrpc://IPADRESS:7000/</url>
    <info>HmHue</info>
 </ipc>
 ```
  
and restart the ccu twice


* all your Hue lamps will shown as a RGBW device at your ccu's inbox
* all your groups will also shown as a RGBW device
* all your scenes will mapped to remote control devices