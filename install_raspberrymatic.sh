mount -o remount,rw /

# check addon is there
if [ ! -d /usr/local/addons/hvl ]; then
  mkdir -p /usr/local/addons/hvl
fi

cd /usr/local/addons/hvl

wget https://nodejs.org/dist/v6.10.0/node-v6.10.0-linux-armv7l.tar.xz -Onode.tar.xz --no-check-certificate
tar xf node.tar.xz
rm node.tar.xz
mv node-v6.10.0-linux-armv7l node
# link it
ln /usr/local/addons/hvl/node/bin/node /usr/bin/node -s
ln /usr/local/addons/hvl/node/bin/npm /usr/bin/npm -s

# Set some new Paths for NPM -> /root is RO 
npm set cache=/usr/local/addons/hvl/.npm
npm set init-module=/usr/local/addons/hvl/.npm-init.js
npm set userconfig=/usr/local/addons/hvl/.npmrc
npm set path=/usr/local/addons/hvl/.npm


# Install Core System
npm install homematic-virtual-interface


# Add Button to System Prefrences
cat >> /tmp/inst_button <<EOF
#!/bin/tclsh

package require HomeMatic

set ID          hvl
set URL         /addons/hvl/index.html
set NAME        "Homematic Virt. Interface"

array set DESCRIPTION {
  de {<li>Stellt einen virtuellen Layer f&uuml;r die Nutzung div. Ger&auml;te (Hue, Sonos) direkt aus der CCU zur Verf&uuml;gung</li>} 
  en {<li>provides a virtual layer to control other devices from CCU (eg Hue or Sonos).</li>}
}

::HomeMatic::Addon::AddConfigPage \$ID \$URL \$NAME [array get DESCRIPTION]


EOF

/bin/tclsh /tmp/inst_button

# clean the mess up
rm /tmp/inst_button

# Build JS Redirector 

if [ ! -f /usr/local/etc/config/addons/www/hvl/index.html ]; then
mkdir /usr/local/etc/config/addons/www/hvl

cat > /usr/local/etc/config/addons/www/hvl/index.html <<EOF
<script type="text/javascript">
  window.location.href='http://' + window.location.host +':8300/'
</script>
EOF
fi

# Add Interface 
if [ $(cat /usr/local/etc/config/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i /usr/local/etc/config/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8301<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

# Add Interface Template
if [ $(cat /etc/config_templates/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i /etc/config_templates/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8301<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

#Setup config.json

if [ ! -f /usr/local/etc/config/hvl/config.json ]; then
	
	if [ ! -d /usr/local/etc/config/hvl ]; then
		mkdir /usr/local/etc/config/hvl
	fi
	
	touch /usr/local/etc/config/hvl/config.json
cat > /usr/local/etc/config/hvl/config.json <<EOF
{
  "ccu_ip": "127.0.0.1",
  "local_ip": "127.0.0.1",
  "local_rpc_port": 8301,
  "web_http_port":8300,
  "restart_command":"/etc/init.d/S51hvl restart",
  "plugins": []
}
EOF
fi

#build system launcher
if [ ! -f /usr/local/etc/config/rc.d/hvl ]; then
  wget --no-check-certificate -nv -O /usr/local/etc/config/rc.d/hvl https://raw.githubusercontent.com/thkl/Homematic-Virtual-Interface/master/rc.d/hvl
  chmod +x /usr/local/etc/config/rc.d/hvl
fi

#back to RO
mount -o remount,ro /
