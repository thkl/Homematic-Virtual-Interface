#!/bin/bash

USER_HOME=$(eval echo ~${SUDO_USER})
path="$PWD"
plugins=()
for f in plugins/*; do
    if [ -d $f ]; then
	plugins+=($f)
    fi
done

echo "Root path is ${path}"
echo "Installing root dependencies in " ${path}
cd ${path}
npm install

for ppath in "${plugins[@]}"
do
    echo "Installing dependencies for plugin in " ${ppath}
    cd ${path}/${ppath}
    npm install
    cd ${path}
done

if [ ! -d "${USER_HOME}/.hm_virtual_interface" ]; then
  echo "build new configuration directory and config"
  mkdir ${USER_HOME}/.hm_virtual_interface
  touch ${USER_HOME}/.hm_virtual_interface/config.json
else
  echo "Config is here skipping this step"
fi