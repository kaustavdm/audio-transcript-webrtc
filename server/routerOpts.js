module.exports = {

  roomOptions: {
    mediaCodecs: [{
      kind: 'audio',
      name: 'audio/opus',
      clockRate: 48000,
      parameters:
      {
        useInbandFec: 1,
        minptime: 10
      }
    }]
  },

  peerTransport: {
    udp: true,
    tcp: true
  }
}
