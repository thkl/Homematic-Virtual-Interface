// following imports are mandatory

import * as UI from '/assets/js/ui.js'
import {Admin} from '/assets/js/admin.js'

export class AdminPlatform extends Admin {
  showDevices () {
    this.pluginCanvas.append($('<h3>').append('Devices'))
    let grid = new UI.DatabaseGrid('deviceList', undefined, {})
    grid.setTitleLabels(['Name', 'Type', 'HM Serial', 'HM Type', 'Last Seen'])
    grid.setColumns([
      {sz: UI.cell3, sort: 0},
      {sz: UI.cell2, sort: 1},
      {sz: UI.cell2, sort: 2},
      {sz: UI.cell2, sort: 3},
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
      return ([
        item.name,
        item.type,
        item.serial,
        item.hmType,
        item.lastMessage])
    })

    this.pluginCanvas.append(grid.render())
  }
}
