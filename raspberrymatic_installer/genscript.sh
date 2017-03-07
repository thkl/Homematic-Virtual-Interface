mkdir -p tmp
rm -rf tmp/*
mkdir -p tmp/hvl
mkdir -p tmp/www

# copy all relevant stuff
cp -a update_script tmp/
cp -a rc.d tmp/
#cp -a node tmp/hvl
cp -a VERSION tmp/www/
#cp -a node_modules tmp/hvl
cp -a etc tmp/hvl

# generate archive
cd tmp
#tar --owner=root --group=root --exclude=.*.* -czvf ../hvl-raspb-$(cat ../VERSION).tar.gz *
tar --exclude=._* -czvf ../hvl-raspb-$(cat ../VERSION).tar.gz *
cd ..
rm -rf tmp
