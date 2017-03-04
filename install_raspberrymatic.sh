mount -o remount,rw /
cd /usr/local/

wget https://nodejs.org/dist/v6.10.0/node-v6.10.0-linux-armv7l.tar.xz -Onode.tar.xz --no-check-certificate
tar xf node.tar.xz
rm node.tar.xz
mv node-v6.10.0-linux-armv7l node
# link it
ln /usr/local/node/bin/node /usr/bin/node -s
ln /usr/local/node/bin/npm /usr/bin/npm -s

# Set some new Paths for NPM -> /root is RO 
npm set cache=/usr/local/.npm
npm set init-module=/usr/local/.npm-init.js
npm set userconfig=/usr/local/.npmrc
npm set path=/usr/local/.npm

# Install Core System
npm install homematic-virtual-interface


# Add Button to System Prefrences
if [ $(cat /usr/local/etc/config/hm_addons.cfg|grep "hvl"|wc -l) -eq 0 ];then
cat >> /usr/local/etc/config/hm_addons.cfg <<EOF

hvl {CONFIG_URL /addons/hvl/ CONFIG_DESCRIPTION {de {Virtueller Homematic Ger&aumltelayer} en {virtual homematic device layer}} ID hvl CONFIG_NAME HVL}
EOF

# Build JS Redirector 
mkdir /usr/local/etc/config/addons/www/hvl

cat > /usr/local/etc/config/addons/www/hvl/index.html <<EOF
<script type="text/javascript">
  window.location.href='http://' + window.location.host +':8182/'
</script>
EOF
fi

# Add Interface 
if [ $(cat /usr/local/etc/config/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i /usr/local/etc/config/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8000<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

# Add Interface Template
if [ $(cat /etc/config_templates/InterfacesList.xml | grep '<name>HVL</name>' | wc -l ) -eq 0 ]; then
	sed -i /etc/config_templates/InterfacesList.xml -e "s/<\/interfaces>/<ipc><name>HVL<\/name><url>xmlrpc:\/\/127.0.0.1:8000<\/url><info>HVL<\/info><\/ipc><\/interfaces>/"
fi

#Setup config.json

if [ ! -f /usr/local/etc/config/hvl/config.json ]; then
	mkdir /usr/local/etc/config/hvl
	touch /usr/local/etc/config/hvl/config.json
cat > /usr/local/etc/config/hvl/config.json <<EOF
{
  "ccu_ip": "127.0.0.1",
  "local_ip": "127.0.0.1",
  "local_rpc_port": 8000,
  "plugins": []
}
EOF
fi

#build system launcher
if [ ! -f /etc/init.d/S51hvl ]; then
cat > /etc/init.d/S51hvl <<EOF
#!/bin/sh
### BEGIN INIT INFO
# Provides:	Homematic Virtual Interface Layer
# Required-Start:    \$remote_fs \$syslog
# Required-Stop:     \$remote_fs \$syslog
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Start daemon at boot time
# Description:       Enable service provided by daemon.
### END INIT INFO


dir="/usr/local/node_modules/homematic-virtual-interface"
cmd="node lib/index.js -C /usr/local/etc/config/hvl"
user="root"

name="hvl"
pid_file="/var/run/hvl.pid"
stdout_log="/var/log/hvl.log"
stderr_log="/var/log/hvl.err"

get_pid() {
    cat "\$pid_file"
}

is_running() {
    [ -f "\$pid_file" ] && ps `get_pid` > /dev/null 2>&1
}

case "\$1" in
    start)
    if is_running; then
        echo "Already started"
    else
        echo "Starting \$name"
        cd "\$dir"
        
        \$cmd \$1 >> "\$stdout_log" 2>> "\$stderr_log" &
        
        echo \$! > "\$pid_file"
        if ! is_running; then
            echo "Unable to start, see \$stdout_log and \$stderr_log"
            exit 1
        fi
    fi
    ;;
    stop)
    if is_running; then
        echo -n "Stopping \$name.."
        kill \`get_pid\`
        for i in {1..10}
        do
            if ! is_running; then
                break
            fi

            echo -n "."
            sleep 1
        done
        echo

        if is_running; then
            echo "Not stopped; may still be shutting down or shutdown may have failed"
			if [ -f "\$pid_file" ]; then
                rm "\$pid_file"
            fi
			exit 1
        else
            echo "Stopped"
            if [ -f "\$pid_file" ]; then
                rm "\$pid_file"
            fi
        fi
    else
        echo "Not running"
    fi
    ;;
    restart)
    \$0 stop
    if is_running; then
        echo "Unable to stop, will not attempt to start"
        exit 1
    fi
    \$0 start
    ;;
    status)
    if is_running; then
        echo "Running"
    else
        echo "Stopped"
        exit 1
    fi
    ;;
    *)
    echo "Usage: \$0 {start|stop|restart|status}"
    exit 1
    ;;
esac

exit 0
EOF

chmod +x /etc/init.d/S51hvl
fi

#back to RO
mount -o remount,ro /
