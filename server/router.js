const mediasoup = require('mediasoup')
const webrtc = mediasoup.webrtc
const debug = require('debug')('router')
const options = require('./routerOpts')

function Router (wss) {
  var peerConnections = {}

  this.mediaServer = mediasoup.Server({
    logLevel: 'debug'
  })

  function sendMsg (ws, type, payload) {
    ws.send(JSON.stringify({ type: type, payload: payload }))
  }

  function sendError (ws, data = 'Invalid data') {
    sendMsg(ws, 'Error', data)
  }

  function createRoom () {
    return this.mediaServer.createRoom(options.roomOptions)
      .then((room) => {
        debug('createRoom() succeeded')
        return handleRoom(room)
      })
      .catch((err) => debug('createRoom() ERROR', err))
  }

  function handleRoom (room) {
    wss.on('connection', function (ws) {
      ws.isAlive = true
      ws.on('pong', function () {
        this.isAlive = true
      })

      ws.on('message', function (data) {
        let message
        try {
          message = JSON.parse(data)
        } catch (err) {
          sendError(ws)
          return
        }
        if (!message.type || !message.payload) {
          sendError(ws, 'Unknown message type')
          return
        }
        switch (message.type) {
          case 'Start':
            handleParticipant(message.payload, ws, room)
            break
          case 'Answer':
            handleAnswer(message.payload, ws, room)
            break
        }
      })
    })
    return Promise.resolve(wss, room)
  }

  /**
   *
   * @param {Object} payload - Data sent by user for 'Start' event
   * @param {string} payload.username - A unique username for the current user
   * @param {boolean} payload.usePlanB - Whether it is a Chrome based endpoint
   * @param {string} payload.sdp - SDP of the user
   * @param {object} ws - WebSocket connection
   * @param {object} room - MediaSoup room
   */
  function handleParticipant (payload, ws, room) {
    debug('Handling new participant')
    let mPeer = room.Peer(payload.username)
    let pc = new webrtc.RTCPeerConnection({
      peer: mPeer,
      usePlanB: payload.usePlanB || false,
      maxBitrate: 48000
    })

    pc.setCapabilities(payload.sdp)
      .then(() => {
        sendSDPOffer(payload, pc, ws)
        setReceiver(mPeer)
      })
      .catch(err => {
        debug('Error setting peer capabilities', err)
        sendError(ws, `Unable to set peer capability. Reason: ${err.message}`)
        pc.close()
      })

    pc.on('signalingstatechange', () => {
      debug(`Signaling state change for peer: ${payload.username} to ${pc.signalingState}`)
    })

    pc.on('negotiationneeded', () => sendSDPOffer(payload, pc, ws))

    ws.on('close', () => {
      debug('Connection closed')
      pc.close()
    })
    peerConnections[payload.username] = pc
  }

  function setReceiver (mPeer) {
    mPeer.createTransport()
      .then(transport => {
        const receiver = mPeer.RtpReceiver('audio', transport)
        receiver.on('rtpraw', packet => {
          debug('Received RTP packet', packet)
        })
      })
      .catch(err => {
        debug(`Error creating transport for ${mPeer.id}`, err)
      })
  }

  function sendSDPOffer (payload, pc, ws) {
    pc.createOffer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 0
    })
      .then(desc => pc.setLocalDescription(desc))
      .then(() => {
        dumpPeer(pc.peer, 'peer.dump after createOffer')
        sendMsg(ws, 'Offer', pc.localDescription.serialize())
      })
      .catch(err => {
        debug('Error sending SDP offer', err)
        sendError(ws, `Unable to set and send SDP offer. Reason: ${err.message}`)
      })
  }

  function handleAnswer (payload, ws, room) {
    let pc = peerConnections[payload.username]
    if (!pc) {
      sendError(ws, 'Invalid peer')
      return
    }
    const desc = new webrtc.RTCSessionDescription(payload.answer)
    debug(`Processed answer from ${payload.username}`)
    pc.setRemoteDescription(desc)
      .then(() => {
        debug('setRemoteDescription for Answer OK username' + payload.username)
        debug('-- peers in the room = ' + room.peers.length)

        dumpPeer(pc.peer, 'peer.dump after setRemoteDescription(answer):');
      })
      .catch(err => {
        debug('setRemoteDescription for Answer ERROR:', err)
      })
  }

  // function broadcast (data) {
  //   wss.clients.forEach(function each (client) {
  //     if (client.readyState === WebSocket.OPEN) {
  //       client.send(data)
  //     }
  //   })
  // }

  function dumpPeer (peer, caption) {
    debug(caption + ' transports=%d receivers=%d senders=%d',
      peer.transports.length, peer.rtpReceivers.length, peer.rtpSenders.length
    )
  }

  setInterval(function ping () {
    wss.clients.forEach(function each (ws) {
      if (ws.isAlive === false) return ws.terminate()

      ws.isAlive = false
      ws.ping('', false, true)
    })
  }, 10000)

  return createRoom()
}

module.exports = Router
