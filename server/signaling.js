const debug = require('debug')('signaling')
const mediasoup = require('mediasoup')
const RTCPeerConnection = mediasoup.RTCPeerConnection
const RTCSessionDescription = mediasoup.RTCSessionDescription

let connections = []
let clientIndex = 0

function signaling (mediaRouter, room, wss) {
  function getId (ws) {
    if (ws.additionalId) {
      return ws.additionalId
    } else {
      clientIndex++
      ws.additionalId = 'member_' + clientIndex
      return ws.additionalId
    }
  }

  function getClientCount () {
    return wss.clients.length
  }

  function sendback (ws, message) {
    let str = JSON.stringify(message)
    ws.send(str)
  }

  // --- for v1.x ---
  function preparePeer (ws, message, downOnly) {
    const id = getId(ws)
    const planb = message.planb
    const capabilitySDP = message.capability

    let peer = room.Peer(id)
    let peerconnection = new RTCPeerConnection({
      peer: peer,
      usePlanB: planb
    })
    debug('--- create RTCPeerConnection --')
    debug('-- peers in the room = ' + room.peers.length)

    peerconnection.on('close', function (err) {
      debug('-- PeerConnection.closed,  err:', err)
    })
    peerconnection.on('signalingstatechange', function () {
      debug('-- PeerConnection.signalingstatechanged, state=' + peerconnection.signalingState)
    })
    peerconnection.on('negotiationneeded', () => {
      debug('-- PeerConnection.negotiationneeded!! id=' + id)

      // --- send SDP here ---
      sendOffer(ws, peerconnection, downOnly)
    })

    peerconnection.setCapabilities(capabilitySDP)
      .then(() => {
        debug('peerconnection.setCapabilities() OK')

        addPeerConnection(id, peerconnection)
        sendOffer(ws, peerconnection)
      })
      .catch((err) => {
        debug('peerconnection.setCapabilities() ERROR:', err)
        peerconnection.close()
      })
  }

  function sendOffer (ws, peerconnection, downOnly) {
    const id = getId(ws)
    debug('offer to id=' + id)
    let offerOption = { offerToReceiveAudio: 1, offerToReceiveVideo: 1 }
    if (downOnly) {
      offerOption.offerToReceiveAudio = 0
      offerOption.oofferToReceiveVideo = 0
    }

    peerconnection.createOffer(offerOption)
      .then((desc) => {
        return peerconnection.setLocalDescription(desc)
      })
      .then(() => {
        dumpPeer(peerconnection.peer, 'peer.dump after createOffer')

        sendSDP(ws, peerconnection.localDescription)
      })
      .catch((error) => {
        debug('error handling SDP offer to participant: %s', error)

        // Close the peerconnection
        peerconnection.reset()
        peerconnection.close()
        deletePeerConnection(id)
      })
  }

  function handleAnswer (ws, message) {
    const id = getId(ws)
    let peerconnection = getPeerConnection(id)
    if (!peerconnection) {
      console.warn('WARN: connection not found. id=', id)
      return
    }

    // debug("remote SDP=" + message.sdp);
    let desc = new RTCSessionDescription({
      type: 'answer',
      sdp: message.sdp
    })

    peerconnection.setRemoteDescription(desc)
      .then(function () {
        debug('setRemoteDescription for Answer OK id=' + id)
        debug('-- peers in the room = ' + room.peers.length)

        dumpPeer(peerconnection.peer, 'peer.dump after setRemoteDescription(answer):')
      })
      .catch((err) => {
        debug('setRemoteDescription for Answer ERROR:', err)
      })
  }

  function dumpPeer (peer, caption) {
    debug(caption + ' transports=%d receivers=%d senders=%d',
      peer.transports.length, peer.rtpReceivers.length, peer.rtpSenders.length
    )
  }

  function addPeerConnection (id, pc) {
    connections[id] = pc
  }

  function getPeerConnection (id) {
    const pc = connections[id]
    return pc
  }

  function deletePeerConnection (id) {
    delete connections[id]
  }

  function cleanUpPeer (ws) {
    const id = getId(ws)
    let peerconnection = getPeerConnection(id)
    if (!peerconnection) {
      console.warn('WARN: cleanUpPeer(id) , connection not found. id=', id)
      return
    }

    debug('PeerConnection close. id=' + id)
    peerconnection.close()
    deletePeerConnection(id)

    debug('-- peers in the room = ' + room.peers.length)
  }

  function sendSDP (ws, sessionDescription) {
    const id = getId(ws)
    let message = { sendto: id, type: sessionDescription.type, sdp: sessionDescription.sdp }
    debug('--- sending sdp ---')
    debug('sendto:' + message.sendto + '   type:' + message.type)
    sendback(ws, message)
  }

  wss.on('connection', function connection (ws) {
    debug('client connected. id=' + getId(ws) + '  , total clients=' + getClientCount())

    ws.on('close', function () {
      debug('client closed. id=' + getId(ws) + '  , total clients=' + getClientCount())
      cleanUpPeer(ws)
    })

    ws.on('error', function (err) {
      debug('ERROR:', err)
    })
    ws.on('message', function incoming (data) {
      const inMessage = JSON.parse(data)
      const id = getId(ws)
      debug('received id=%s type=%s', id, inMessage.type)

      if (inMessage.type === 'call') {
        debug('got call from id=' + id)
        // let message = { sendto: id, type: 'response' }
        debug('send Offer to id=' + id)

        // sendback(ws, message);
        // -- prepare PeerConnection and send SDP --
        const downOnlyRequested = false
        preparePeer(ws, inMessage, downOnlyRequested)
        // NOT here, MUST USE Promise to sendOffer()
        // if (peerconnection) {
        //  sendOffer(ws, peerconnection);
        // }
      } else if (inMessage.type === 'call_downstream') {
        // -- requested down stream only (for watching realtime-streaming) --
        const downOnlyRequested = true
        preparePeer(ws, inMessage, downOnlyRequested)
      } else if (inMessage.type === 'offer') {
        debug('got Offer from id=' + id)
        debug('MUST NOT got offer')
      } else if (inMessage.type === 'answer') {
        debug('got Answer from id=' + id)
        handleAnswer(ws, inMessage)
      } else if (inMessage.type === 'candidate') {
        debug('MUST NOT got candidate')
      } else if (inMessage.type === 'bye') {
        cleanUpPeer(ws)
      }
    })

    sendback(ws, { type: 'welcome' })
  })

  return Promise.resolve()
}

module.exports = signaling
