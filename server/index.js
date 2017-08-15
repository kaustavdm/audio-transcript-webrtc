/**
 * Server for xplex Internal API (nicknamed, rig)
 */

const debug = require('debug')('app')
const { readFileSync } = require('fs')
const https = require('https')
const WebSocket = require('ws')

// Load config
let config
let httpsConfig

try {
  config = require('../config')
} catch (e) {
  console.error('Unable to load config.')
  debug(e)
  process.exit(1)
}

try {
  httpsConfig = {
    key: readFileSync(config.ssl_key).toString(),
    cert: readFileSync(config.ssl_cert).toString()
  }
} catch (e) {
  console.error('Unable to load SSL certificate files.')
  debug(e)
  process.exit(1)
}

// Load app
const app = require('./app')

// Load mediasoup server
const router = require('./router')

// Create HTTPS app server
const appServer = https.createServer(httpsConfig, app)

// Setup websocket server
const wss = new WebSocket.Server({ server: appServer })

// Create room in mediasoup
router(wss)
  .then(() => {
    // Launch app server
    appServer.listen(config.port, () => {
      debug(`App server listening on ${config.port}`)
    })
  })
