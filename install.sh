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


info "Installing Git"

install_package "git"


if [ $(type -P node | grep node|wc -l) -eq 0 ]; 
then
  if $(uname -m | grep -Eq ^armv6); then
    wget -q https://nodejs.org/dist/v4.0.0/node-v4.0.0-linux-armv7l.tar.gz 
    tar -xvf node-v4.0.0-linux-armv7l.tar.gz  >/dev/null
    cd node-v4.0.0-linux-armv7l
    sudo cp -R * /usr/local/
    cd /home/pi
    rm node-v4.0.0-linux-armv7l.tar.gz
    rm node-v4.0.0-linux-armv7l -R
  else
    curl -sL https://deb.nodesource.com/setup_6.x | sudo -E bash -
    sudo apt-get install -y nodejs >/dev/null
  fi
else
   info "node is installed, skipping..."
fi


info "Installing Virtual Layer Software"

cd /home/pi
git clone https://github.com/thkl/Homematic-Virtual-Interface.git
cd /home/pi/Homematic-Virtual-Interface
chmod +x setup.sh
./setup.sh



whiptail --yesno "Would you like to start the virtual layer at boot by default?" $DEFAULT 20 60 2
RET=$?
if [ $RET -eq 0 ]; then

    sudo cp /home/pi/Homematic-Virtual-Interface/lib/hmvi /etc/init.d/
  	
  	sudo chmod 755 /etc/init.d/hmvi
	sudo update-rc.d hmvi defaults
fi

info "Done. If there are no error messages you are done."
info "Start the by typing bin/hmvi"