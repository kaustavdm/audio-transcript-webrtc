const Speech = require('@google-cloud/speech')
const debug = require('debug')('speech:google')

const request = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 48000,
    languageCode: 'en-US'
  },
  interimResults: false
}

// Create a recognize stream
function recognizeStream (broadcast) {
  const speech = Speech()
  return speech.streamingRecognize(request)
    .on('error', console.error)
    .on('data', function (data) {
      debug('Data received: %j', data)
      if (!data.error && data.results && data.results.length > 0) {
        broadcast(data.results[0].alternatives[0].transcript)
      }
    })
    .on('pipe', function () {
      debug('Receiving')
    })
}

module.exports = recognizeStream
