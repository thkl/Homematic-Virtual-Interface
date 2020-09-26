
const path = require('path')

class ZHASwitch {
    
    
    constructor(plugin,sensor) {
    let self = this
    var devfile = path.join(__dirname,'HM-RC-8.json');
    plugin.server.publishHMDevice(plugin.getName(),'HM-RC-8',devfile,1);

    let dSer = 'DEC' + sensor.uniqueid.substring(13,22).replace(/[.:#_()-]/g,'')
        this.hmDevice = plugin.bridge.initDevice(plugin.getName(),dSer,"HM-RC-8",dSer) 
        sensor.on('change', () => {
          var channel
          switch (sensor.buttonevent) {
            case 1001:
                self.contPress(1)
                break
            case 1002:
                self.keyPress(1,'PRESS_SHORT',true)
            break
            case 1003:
            { 
                self.keyPress(1,'PRESS_LONG',true)
                self.keyPress(1,'PRESS_LONG_RELEASE',true)
            }   
            break

            case 2001:
                self.contPress(2)
                break
            case 2002:
                self.keyPress(2,'PRESS_SHORT',true)
            break
            case 2003:
            { 
                self.keyPress(2,'PRESS_LONG',true)
                self.keyPress(2,'PRESS_LONG_RELEASE',true)
            }   
            break

            case 3001:
                self.contPress(3)
                break
            case 3002:
                self.keyPress(3,'PRESS_SHORT',true)
            break
            case 3003:
            { 
                self.keyPress(3,'PRESS_LONG',true)
                self.keyPress(3,'PRESS_LONG_RELEASE',true)
            }   
            break

            case 4001:
                self.contPress(4)
                break
            case 4002:
                self.keyPress(4,'PRESS_SHORT',true)
            break
            case 4003:
            { 
                self.keyPress(4,'PRESS_LONG',true)
                self.keyPress(4,'PRESS_LONG_RELEASE',true)
            }   
            break

            case 5001:
                self.contPress(5)
                break
            case 5002:
                self.keyPress(5,'PRESS_SHORT',true)
            break
            case 5003:
            { 
                self.keyPress(5,'PRESS_LONG',true)
                self.keyPress(5,'PRESS_LONG_RELEASE',true)
            }   
            break
        }
        })
    }

    contPress(channelId) {
        clearInterval(this.tmr)
        let channel = this.hmDevice.getChannelWithTypeAndIndex("KEY", channelId)
        this.tmr = setInterval(()=>{
            channel.updateValue('PRESS_CONT',1,true,true)
        },500)
    }

    keyPress(channelId,keyEvent,autoRelease) {
        clearInterval(this.tmr)
        let channel = this.hmDevice.getChannelWithTypeAndIndex("KEY", channelId)
        channel.updateValue(keyEvent,1,true,true)
        if (autoRelease) {
            setTimeout(function(){
                channel.updateValue(keyEvent,0,true)
              }, 500) 
        }
    }
}


module.exports = ZHASwitch