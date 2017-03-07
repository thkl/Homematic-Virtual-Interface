ADDONNAME=hvl
ADDON_DIR=/usr/local/addons/${ADDONNAME}
CONFIG_DIR=/usr/local/etc/config
WWW_DIR=${CONFIG_DIR}/addons/www/${ADDONNAME}

#check if we have our core module; if not go ahead and call the installer stuff
if [ ! -f ${ADDON_DIR}/node_modules/homematic-virtual-interface/lib/index.js ]; then

mkdir -p ${WWW_DIR}
chmod 755 ${WWW_DIR}

#install node and fetch the core module
cd ${ADDON_DIR}

wget https://nodejs.org/dist/v6.10.0/node-v6.10.0-linux-armv7l.tar.xz -Onode.tar.xz --no-check-certificate
tar xf node.tar.xz
rm node.tar.xz
mv node-v6.10.0-linux-armv7l node
# since the settingsfile of npm is located in /root/.npm we need rw on the root filesystem
mount -o remount,rw /

${ADDON_DIR}/node/bin/node ${ADDON_DIR}/node/bin/npm set cache=${ADDON_DIR}/.npm
${ADDON_DIR}/node/bin/node ${ADDON_DIR}/node/bin/npm set init-module=${ADDON_DIR}/.npm-init.js
${ADDON_DIR}/node/bin/node ${ADDON_DIR}/node/bin/npm set userconfig=${ADDON_DIR}/.npmrc
${ADDON_DIR}/node/bin/node ${ADDON_DIR}/node/bin/npm set path=${ADDON_DIR}/.npm

# Add Interface Template
if [ $(cat /etc/config_templates/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i /etc/config_templates/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8301<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

#switch back to read only
mount -o remount,ro /

#install the core system
${ADDON_DIR}/node/bin/node ${ADDON_DIR}/node/bin/npm  install homematic-virtual-interface

#add the menu button
cd /usr/local/addons/hvl/etc/
chmod +x update_addon
touch /usr/local/etc/config/hm_addons.cfg
/usr/local/addons/hvl/etc/update_addon hvl /usr/local/addons/hvl/etc/hvl_addon.cfg

# Add Interface 
if [ $(cat ${CONFIG_DIR}/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i ${CONFIG_DIR}/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8301<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

#link redirector
ln ${ADDON_DIR}/etc/www/index.html ${WWW_DIR}/index.html

#Setup config.json
if [ ! -f ${CONFIG_DIR}/hvl/config.json ]; then
	cp ${ADDON_DIR}/etc/config.json.default ${CONFIG_DIR}/hvl/config.json
	sed -i ${CONFIG_DIR}/hvl/config.json -e "s/ADDON_DIR/\/usr\/local\/addons\/hvl/g"
fi


fi