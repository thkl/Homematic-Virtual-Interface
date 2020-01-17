# Homematic-Virtual-Interface
this is a virtual Interface for Homematic CCU.
You may add serval plugins to connect other devices to your CCU

[![Donate some coins if you want](https://www.paypalobjects.com/en_US/i/btn/btn_donate_SM.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=EF3ZNY8CJMQZJ)


This is work in progress.


Quick Install:

 ```
wget -nv -O- https://raw.githubusercontent.com/thkl/Homematic-Virtual-Interface/master/install.sh | sudo -E bash -
 ```
Raspberrymatic:

If you want to use this on an <a href="https://github.com/jens-maus/RaspberryMatic">Raspberrymatic CCU</a> , please use this <a href="https://github.com/thkl/Homematic-Virtual-Interface/blob/master/raspberrymatic_installer/hvl-raspb-0.0.8.tar.gz">CCU Addon (hvl-raspb-0.0.8.tar.gz)</a>. The addon will fetch all necessary files from the web at the first launch. So please note: You will need internet access on your CCU.

The Raspberrymatic Version does not need any manual setup. Just use the WebInterface to fetch new plugins and set them up.


Configuration:


fill the config.json ....

Keys : 

 ```
ccu_ip : This is mandatory. Fill your CCUs ip adress in here.
local_ip  : Normally the server will choose the first local network interface. If you want to use an other IF setup the IFs ip here.
web_http_port": Normally the servers Webinterface is located at port 8182. If you want to change that, this is the keyword of your choise.


 ```


Start:

 ```
bin/hmviservice start
 ```



add the service to /etc/config_templates/InterfacesList.xml  at your ccu

 ```
 <ipc>
    <name>HVL</name>
    <url>xmlrpc://IPADRESS:7000/</url>
    <info>HVL</info>
 </ipc>
 ```
   
  
and restart the ccu twice


If you are not able to setup the InterfacesList at your CCU, there is a addon in lib\ named hvl_addon.tar.gz for that.


Add plugins to the plugins directory. There is a example Hue Plugin with the following functionality

* all your Hue lamps will shown as a RGBW device at your ccu's inbox
* all your groups will also shown as a RGBW device
* all your scenes will mapped to remote control devices


Current plugins:

HuePlugin, LightifyPlugin, LogicPlugin, LogitechHarmony, NetAtmo, Sonos

How to remove the stuff:

There is currently no automated process so you have to do it step by step.
1st make sure the hvl is still running (ccu is not able to remove objects without response from interface)
2nd remove all your virtual devices from your ccu's device list
3rd remove the changes in in /etc/config_templates/InterfacesList.xml
4rd run this to remove the interface from regadom at your ccu's webinterface (Programs/Test Script): dom.DeleteObject(dom.GetObject('HVL'));
5th reboot your ccu

Trademarks:

Homematic is a registered trademark of the eq-3 AG | Sonos is a registered trademark of Sonos Inc | hue is a registered trademark of Philips Lighting Holding B.V |  Lightify is a registered trademark of OSRAM GmbH | netatmo is a registered trademark of NETATMO | Logitech Harmony is a registered trademark of Logitech International S.A.

This project is an unofficial pice of software to control all these devices via there SDK and has nothing in common with the companies above.
