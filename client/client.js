/* eslint-env browser */
/* global adapter */

var localStream = null
window.addEventListener('load', function () {
  var pc = null
  var recorder = null
  var audioContainer = document.getElementById('audio_container')
  var transcriptContainer = document.getElementById('transcript_container')
  var wsUrl = 'wss://' + window.location.hostname + ':' + window.location.port + '/'

  var username = 'user' + Math.round(Math.random() * 1000)

  var ws = new WebSocket(wsUrl)

  function recorderOndataavailable (event) {
    if (event.data && event.data.size > 0) {
      ws.send(event.data)
    }
  }

  function sendMsg (type, payload) {
    ws.send(JSON.stringify({
      type: type,
      payload: payload
    }))
  }

  ws.addEventListener('close', function () {
    console.log('WebSocket connection closed')
    if (pc) {
      pc.close()
    }
    if (recorder) {
      recorder.stop()
    }
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
      case 'Transcript':
        handleTranscript(message.payload)
    }
  })

  function handleTranscript (payload) {
    console.log('Transcript', payload)
    var t = document.createElement('p')
    t.setAttribute('class', 'transcript-entry')
    t.innerHTML = `<span class='transcript-user'>\
    ${payload.username === username ? 'You' : payload.username}<span>: ${payload.transcript}`
    transcriptContainer.appendChild(t)
  }

  function getUserMedia () {
    return navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then(stream => {
        localStream = stream
        recorder = new MediaRecorder(localStream, {
          mimeType: recorderMimeType()
        })
        recorder.ondataavailable = recorderOndataavailable
        return stream
      })
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
        if (recorder) {
          recorder.start(100)
        }
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

  function recorderMimeType () {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      return 'audio/webm;codecs=opus'
    }
    return 'audio/ogg;codecs=opus'
  }

  ws.addEventListener('open', function () {
    console.log('WebSocket connection opened to ' + wsUrl)
    getUserMedia()
      .then(createPeerConnection)
  })
})
