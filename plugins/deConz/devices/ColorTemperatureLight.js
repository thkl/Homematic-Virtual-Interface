const path = require('path')
const BasicLight = require(path.join(__dirname, 'BasicLight.js'))

class ColorTemperatureLight extends BasicLight {
  constructor (plugin, light) {
    super(plugin, light, 'VIR-LG-WHITE-DIM')
  }

  async handleCCUEvent (parameter) {
    let changed = await super.handleCCUEvent(parameter)

    var newValue = parameter.newValue
    var channel = this.hmDevice.getChannel(parameter.channel)

    if (parameter.name === 'WHITE') {
      let colorTemp = Number(parseInt(newValue) / 10).toFixed(0)
      this.currentState.ct(colorTemp)
      channel.updateValue('WHITE', newValue, true, true)
      changed = true
    }
    return changed
  }

  handleLightChangeEvent (light) {
    let self = this
    super.handleLightChangeEvent(light, 'VIR-LG_WHITE-DIM-CH')

    let state = light.lightState
    let cChannel = self.hmDevice.getChannelWithTypeAndIndex('VIR-LG_WHITE-DIM-CH', 1)
    if (cChannel) {
      cChannel.startUpdating('WHITE')
      let colorTemp = state.ct()
      cChannel.updateValue('WHITE', (colorTemp * 10), true)
      cChannel.endUpdating('WHITE')
    } else {
      this.log.warn('Channel %s %s not found', 1, 'VIR-LG_WHITE-DIM-CH')
    }
  }
}

module.exports = ColorTemperatureLight
