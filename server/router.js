const mediasoup = require('mediasoup')
const debug = require('debug')('router')
const options = require('./routerOpts')
const { cpus } = require('os')

let server = mediasoup.Server({ numWorkers: cpus().length || 1 })

server.createRoom(options.roomOptions)
  .then((room) => {
    debug('server.createRoom() succeeded')
    return room
  })
  .catch((err) => debug('server.createRoom() ERROR', err))

module.exports = server
