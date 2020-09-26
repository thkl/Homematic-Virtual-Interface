
const path = require('path')

class ZHAPresence {

    constructor(plugin,sensor) {
        let self = this
        var devfile = path.join(__dirname,'HM-Sec-MDIR.json');
        plugin.server.publishHMDevice(plugin.getName(),'HM-Sec-MDIR',devfile,1);
        
        let dSer = 'DEC' + sensor.uniqueid.substring(13,22).replace(/[.:#_()-]/g,'')
            this.hmDevice = plugin.bridge.initDevice(plugin.getName(),dSer,"HM-Sec-MDIR",dSer) 
            sensor.on('change', () => {
                let channel = self.hmDevice.getChannelWithTypeAndIndex("MOTION_DETECTOR", 1)
                channel.updateValue('MOTION',sensor.presence,true,true)
            })
    }
}

module.exports = ZHAPresence