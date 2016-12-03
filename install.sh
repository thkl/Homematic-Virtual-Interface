#!/bin/bash
path="$PWD"
plugins=()
for f in plugins/*; do
    if [ -d $f ]; then
	plugins+=($f)
    fi
done

echo "Root path is ${path}"
echo "Installing root dependencies in " ${path}

for ppath in "${plugins[@]}"
do
    echo "Installing dependencies for plugin in " ${ppath}
    cd ${path}/${ppath}
    npm install
    cd ${path}
done

