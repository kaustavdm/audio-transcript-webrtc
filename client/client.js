/* eslint-env browser */
/* global adapter */

window.addEventListener('load', function () {
  var pc = null
  var audioContainer = document.getElementById('audio_container')
  var wsUrl = 'wss://' + window.location.hostname + ':' + window.location.port + '/'

  var username = 'user' + Math.round(Math.random() * 1000)

  let ws = new WebSocket(wsUrl)

  function sendMsg (type, payload) {
    ws.send(JSON.stringify({
      type: type,
      payload: payload
    }))
  }

  ws.addEventListener('close', function () {
    console.log('WebSocket connection closed')
  })

  ws.addEventListener('message', function (event) {
    var message = JSON.parse(event.data)
    switch (message.type) {
      case 'Offer':
        handleOffer(message.payload)
        break
      case 'Error':
        handleError(message.payload)
        break
    }
  })

  function getUserMedia () {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .catch(err => {
        console.error('Unable to get media stream', err)
        alert('Unable to get access to user media')
      })
  }

  function createPeerConnection (stream) {
    pc = new RTCPeerConnection({
      iceServers: [{
        urls: 'stun:stun.l.google.com:19302'
      }]
    })

    // pc.addStream(stream)
    stream.getTracks().forEach(function addTracks (track) {
      pc.addTrack(track, stream)
    })

    pc.addEventListener('iceconnectionstatechange', function () {
      if (pc.iceConnectionState === 'failed') {
        console.error('peerconnection "iceconnectionstatechange" event [state:failed]')
      } else {
        console.log('peerconnection "iceconnectionstatechange" event [state:%s]', pc.iceConnectionState)
      }
    })

    pc.ontrack = function ontrackHandler (event) {
      console.log('Ontrack', event)
      var audioplayer = document.createElement('audio')
      audioplayer.id = 'audio' + event.streams[0].id
      audioplayer.setAttribute('autoplay', '')
      audioplayer.setAttribute('controls', '')
      audioplayer.srcObject = event.streams[0]
      audioContainer.appendChild(audioplayer)
    }

    pc.onremovestream = function onremovestreamHandler (event) {
      console.log('onRemoveStream', event)
      var audioplayer = document.getElementById('audio' + event.stream.id)
      if (audioplayer) {
        audioplayer.parentNode.removeChild(audioplayer)
      }
    }

    return pc.createOffer({
      offerToReceiveAudio: 1,
      offerToReceiveVideo: 0
    })
      .then(function (desc) {
        sendMsg('Start', {
          username: username,
          sdp: desc.sdp,
          usePlanB: isPlanB()
        })
      })
  }

  function handleOffer (payload) {
    console.log('handleOffer', payload)
    var desc = new RTCSessionDescription(payload)
    console.log('Handling offer', desc)
    pc.setRemoteDescription(desc)
      .then(() => pc.createAnswer())
      .then(answer => pc.setLocalDescription(answer))
      .then(() => {
        var answer = pc.localDescription
        console.log('Sending answer', answer)
        sendMsg('Answer', {
          username: username,
          answer: answer
        })
      })
      .catch(err => {
        console.log('Error handling offer', err)
      })
  }

  function handleError (payload) {
    console.log('ERROR', payload)
  }

  function isPlanB () {
    if (['chrome', 'chromium', 'opera', 'safari', 'msedge'].indexOf(adapter.browserDetails.browser) >= 0) {
      return true
    } else {
      return false
    }
  }

  ws.addEventListener('open', function () {
    console.log('WebSocket connection opened to ' + wsUrl)
    getUserMedia()
      .then(createPeerConnection)
  })
})
