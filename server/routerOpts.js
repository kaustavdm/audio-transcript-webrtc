module.exports =
  {
    roomOptions: {

      mediaCodecs: [{
        kind: 'audio',
        name: 'audio/opus',
        clockRate: 48000,
        payloadType: 100,
        numChannels: 2
      },
      {
        kind: 'audio',
        name: 'audio/PCMU',
        payloadType: 0,
        clockRate: 8000
      }]
    },

    peerCapabilities: {
      codecs: [{
        kind: 'audio',
        name: 'audio/opus',
        payloadType: 100,
        clockRate: 48000,
        numChannels: 2
      },
      {
        kind: 'audio',
        name: 'audio/PCMU',
        payloadType: 0,
        clockRate: 8000
      }],

      headerExtensions: [{
        kind: 'audio',
        uri: 'urn:ietf:params:rtp-hdrext:ssrc-audio-level',
        preferredId: 1,
        preferredEncrypt: false
      },
      {
        kind: '',
        uri: 'urn:ietf:params:rtp-hdrext:sdes:rtp-stream-id',
        preferredId: 5,
        preferredEncrypt: false
      }],

      fecMechanisms: []
    }
  }
