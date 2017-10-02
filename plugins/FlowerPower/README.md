# Homematic-Virtual-Interface  - FlowerPower

connect your Parrot Flower Power Sticks to your ccu

Note: You have to install BT Drivers before activating the plugin
Raspberry : 
 sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
and make sure everything is working 
hcitool lescan

you should see some mac like adresses 

if not (operation not permitted) you have to make bt accessible for all users
sudo setcap cap_net_raw+ep /usr/bin/hcitool (see https://www.raspberrypi.org/forums/viewtopic.php?f=66&t=151858)
and
sudo setcap cap_net_raw+eip $(eval readlink -f `which node`)
This grants the node binary cap_net_raw privileges, so it can start/stop BLE advertising.

