const path = require('path')
const States = require(path.join(__dirname, 'States.js'))

module.exports = class ConfigToolState extends States {
  constructor () {
    super(
      'reachable',
      Array.from(arguments)
    )
  }

  reachable () {

  }
}
