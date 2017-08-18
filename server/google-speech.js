const Speech = require('@google-cloud/speech')
const debug = require('debug')('speech:google')

// Create a recognize stream
function recognizeStream (broadcast, req = {}) {
  debug('Creating new stream')
  const speech = Speech()

  const request = {
    config: {
      encoding: req.encoding || 'LINEAR16',
      sampleRateHertz: req.sampleRateHertz || 48000,
      languageCode: req.languageCode || 'en-US'
    },
    interimResults: false
  }
  return speech.streamingRecognize(request)
    .on('error', err => debug('Error in recognize stream', err.message))
    .on('end', () => debug('Ending recognize stream'))
    .on('data', function (data) {
      debug('Data received: %j', data)
      if (!data.error && data.results && data.results.length > 0) {
        broadcast({
          transcript: data.results[0].alternatives[0].transcript,
          isFinal: data.results[0].isFinal
        })
      }
    })
}

module.exports = recognizeStream
