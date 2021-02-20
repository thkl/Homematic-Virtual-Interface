// following imports are mandatory

import * as UI from '/assets/js/ui.js'
import {Admin} from '/assets/js/admin.js'

export class AdminPlatform extends Admin {
  showDevices () {
    let self = this
    this.pluginCanvas.append($('<h3>').append('Devices'))
    let grid = new UI.DatabaseGrid('deviceList', undefined, {})
    grid.setTitleLabels(['Name', 'Type', 'HM Serial', 'HM Type', 'Last Seen', 'Last Action'])
    grid.setColumns([
      {sz: UI.cell2, sort: 0},
      {sz: UI.cell2, sort: 1},
      {sz: UI.cell2, sort: 2},
      {sz: UI.cell2, sort: 3},
      {sz: UI.cell2, sort: 4},
      {sz: UI.cell2, sort: 4}

    ])

    this.application.makeApiRequest('GET', this.pluginName, {method: 'listDevices'}).then((result) => {
      if (result) {
        grid.setBeforeQuery(() => {
          grid.dataset = result
        })

        grid.prepare()
        grid.updateBody()
      }
    })

    grid.setRenderer((row, item) => {
      if (item.hasTestMode === true) {
        row.getCell(1).bind('click', (e) => {
          self.testMode(item)
        })
      }

      return ([
        item.name,
        item.type,
        item.serial,
        item.hmType,
        item.lastMessageTime,
        item.lastMessage])
    })

    this.pluginCanvas.append(grid.render())
  }

  testMode (device) {
    this.application.makeApiRequest('GET', this.pluginName, {method: 'testDevice', uuid: device.uuid}).then((result) => {

    })
  }
}
