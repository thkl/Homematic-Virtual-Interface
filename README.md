# Homematic-Virtual-Interface
this is a virtual Interface for Homematic CCU.
You may add serval plugins to connect other devices to your CCU


This is work in progress.

Quick Install:

 ```
wget -nv -O- https://raw.githubusercontent.com/thkl/Homematic-Virtual-Interface/master/install.sh | bash -
 ```


Configuration:




fill the config.json ....


Start:

 ```
bin/hmvi
 ```



add the service to /etc/config_templates/InterfacesList.xml  at your ccu

 ```
 <ipc>
    <name>HM_VirtualInterface</name>
    <url>xmlrpc://IPADRESS:7000/</url>
    <info>HM_VirtualInterface</info>
 </ipc>
 ```
  
and restart the ccu twice

Add plugins to the plugins directory. There is a example Hue Plugin with the following functionality

* all your Hue lamps will shown as a RGBW device at your ccu's inbox
* all your groups will also shown as a RGBW device
* all your scenes will mapped to remote control devices