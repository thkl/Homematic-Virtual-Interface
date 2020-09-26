
module.exports = {
  mergeArrays: mergeArrays
}

function mergeArrays () {
  let result = []

  Array.from(arguments).forEach(arg => {
    if (arg) {
      result = result.concat(arg)
    }
  })

  return result
}
