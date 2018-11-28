#!/usr/bin/env

# Check if we can use colours in our output
use_colour=0
[ -x /usr/bin/tput ] && tput setaf 1 >&/dev/null && use_colour=1

# Some useful functions
progress() {
	[ $use_colour -eq 1 ] && echo -ne "\033[01;32m"
	echo "$@" >&2
	[ $use_colour -eq 1 ] && echo -ne "\033[00m"
}

info() {
	[ $use_colour -eq 1 ] && echo -ne "\033[01;34m"
	echo "$@" >&2
	[ $use_colour -eq 1 ] && echo -ne "\033[00m"
}

die () {
	[ $use_colour -eq 1 ] && echo -ne "\033[01;31m"
	echo "$@" >&2
	[ $use_colour -eq 1 ] && echo -ne "\033[00m"
	exit 1
}

install_package() {
	package=$1
	info "install ${package}"
	sudo apt-get -y --force-yes install $package 2>&1 > /dev/null
	return $?
}



# check architecture
sudo test "`dpkg --print-architecture`" == "armhf" || die "This Repos is only for armhf."

# as we work with npm version we do not need git anymore
#info "Installing Git"
#install_package "git"

# create own user
if [ $(cat /etc/passwd | grep hmvi |wc -l) -eq 0 ];
then
    info "Creating new user"
    useradd -m hmvi
fi

if [ $(type -P node | grep node|wc -l) -eq 0 ]; 
then
  if $(uname -m | grep -Eq ^armv6); then
    wget -q https://nodejs.org/dist/v4.0.0/node-v4.0.0-linux-armv7l.tar.gz 
    tar -xvf node-v4.0.0-linux-armv7l.tar.gz  >/dev/null
    cd node-v4.0.0-linux-armv7l
    sudo cp -R * /usr/local/
    cd /home/hmvi
    rm node-v4.0.0-linux-armv7l.tar.gz
    rm node-v4.0.0-linux-armv7l -R
  else
    curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
    sudo apt-get install -y nodejs >/dev/null
  fi
else
   info "node is installed, skipping..."
fi


info "Installing Virtual Layer Software"

cd /home/hmvi
runuser -l hmvi -c "npm install homematic-virtual-interface"


whiptail --yesno "Would you like to start the virtual layer at boot by default?" $DEFAULT 20 60 2
RET=$?
if [ $RET -eq 0 ]; then

    sudo cp /home/hmvi/node_modules/homematic-virtual-interface/lib/hmvi_npm /etc/init.d/hmvi
  	
  	sudo chmod 755 /etc/init.d/hmvi
	sudo update-rc.d hmvi defaults
fi

if [ ! -d "/home/hmvi/.hm_virtual_interface" ]; then

  CCUIP=$(whiptail --inputbox "Please enter your CCU IP" 20 60 "000.000.000.000" 3>&1 1>&2 2>&3)
  sudo chown -R hmvi:hmvi /home/hmvi/.hm_*
  echo "build new configuration directory and config"
  mkdir /home/hmvi/.hm_virtual_interface
  touch /home/hmvi/.hm_virtual_interface/config.json
  echo "{\"ccu_ip\":\"$CCUIP\",\"plugins\":[]}" > /home/hmvi/.hm_virtual_interface/config.json
else
  echo "Config is here skipping this step"
fi


info "Done. If there are no error messages you are done."
info "Start the by typing bin/hmvi"
info "There is an addon file named hvl_addon.tar.gz here. Install this at your ccu as additional software, to setup the ccu to use the virtual layer."
