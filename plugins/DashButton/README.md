# Homematic-Virtual-Interface  - Dash Button

this will currently not work on a Raspberrymatic !

first you have to 

 ```
sudo apt-get install libpcap-dev
sudo apt-get install git
sudo setcap 'cap_net_raw,cap_net_admin+eip' $(readlink -f $(which node))
 ```



#### First Time Dash Setup

Follow Amazon's instructions to configure your button to send messages when you push them but not actually order anything. When you get a Dash button, Amazon gives you a list of setup instructions to get going. Just follow this list of instructions, but don’t complete the final step (#3 I think) **Do not select a product, just exit the app**.
