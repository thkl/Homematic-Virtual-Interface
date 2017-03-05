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
	mkdir /usr/local/etc/config/hvl
	touch /usr/local/etc/config/hvl/config.json
cat > /usr/local/etc/config/hvl/config.json <<EOF
{
  "ccu_ip": "127.0.0.1",
  "local_ip": "127.0.0.1",
  "local_rpc_port": 8301,
  "web_http_port":8300,
  "plugins": []
}
EOF
fi

#build system launcher
if [ ! -f /usr/local/etc/config/rc.d/hvl ]; then
cat > /usr/local/etc/config/rc.d/hvl <<EOF
#!/bin/sh
HVLDIR=/usr/local/addons/hvl
CONFIG_URL=/addons/hvl/www/
CONFIG_DIR=/usr/local/etc/config
PIDFILE=/var/run/hvl.pid
STARTRC=/etc/init.d/S51hvl
PSPID=`ps -o pid,comm | awk '{if(\$2=="hvl"){print \$1}}'`


case "\$1" in
  ""|start)
	if [ ! -h \$CONFIG_DIR/addons/www/hvl ]
	then ln -sf \$HVLDIR $CONFIG_DIR/addons/www/hvl
	fi
	if [ ! -h \$STARTRC ]
	then
	  mount -o remount,rw /
	  ln -sf \$CONFIG_DIR/rc.d/hvl \$STARTRC
	  mount -o remount,ro /
	fi
	if [ "\$PSPID" = "" ]
	then
	  \$HVLDIR/node/bin/node \$HVLDIR/node_modules/homematic-virtual-interface/lib/index.js -C \$CONFIG_DIR/hvl  &
	  logger -t homematic -p user.info "started homematic virtual layer"
	fi
	;;

  stop)
  	if [ "\$PSPID" != "" ]
  	then
	  kill -TERM \$PSPID 2>/dev/null
	  sleep 1
	  kill -0 \$PSPID 2>/dev/null
	  if [ \$? -eq 0 ]
	  then
	    sleep 10
	    kill -KILL \$PSPID 2>/dev/null
	  fi
	  logger -t homematic -p user.info "stopped homematic virtual layer"
	fi
	;;

  restart)
  	if [ "\$PSPID" != "" ]
  	then
	  kill -HUP `cat $PIDFILE` 2>/dev/null
	  logger -t homematic -p user.info "stopped (restart) homematic virtual layer"
	  sleep 1
	  kill -0 `cat \$PIDFILE` 2>/dev/null
	  if [ \$? -eq 0 ]
	  then
	    sleep 5
	    kill -KILL `cat \$PIDFILE` 2>/dev/null
	  fi
	fi
	\$HVLDIR/node/bin/node $HVLDIR/node_modules/homematic-virtual-interface/lib/index.js -C \$CONFIG_DIR/hvl >/dev/null &
	logger -t homematic -p user.info "started (restart) homematic virtual layer"
	;;

  info)
	echo "Info: <center><b>Homematic Virtual Layer</b></center>"
	echo "Name: HVL"
	echo "Version: "
	echo "Operations: uninstall restart"
	echo "Config-Url: \$CONFIG_URL"
	echo "Update: "
	;;

  uninstall)
	logger -t homematic -p user.info "removing homematic virtual layer"
	echo "not yet implemented"
	;;

  *)
	echo "Usage: \$0 {start|stop|restart|uninstall}" >&2
	exit 1
	;;
esac

exit 0

EOF
chmod +x /usr/local/etc/config/rc.d/hvl
fi


#back to RO
mount -o remount,ro /
