const express = require('express')

// Instantiate Express app
let app = express()

// Security measures
app.disable('x-powered-by')

// Serve `client` directory as static on web root
app.use(express.static('client'))

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found')
  err.status = 404
  next(err)
})

// error handler
// no stacktraces leaked to user unless in development environment
app.use(function (err, req, res, next) {
  err.status = err.status || 500
  res.status(err.status).json({
    msg: err.status === 500 ? 'Unable to perform request' : err.message,
    status: err.status
  })
})

module.exports = app
