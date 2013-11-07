var log     = require('blunt-log')
var http    = require('http')
var stak    = require('blunt-stack')
var _req    = require('./lib/request.js')
var _res    = require('./lib/response.js')
var merge   = require('./lib/merge.js')
var nym     = require('nym')()

var server  = false;

var _stack  = []

exports = module.exports = _create

var app = {}

function _create() {
  merge(app, _app)
  merge(app, nym)

  app.use(function(req, res, next) {
    merge(req.__proto__, _req)
    merge(res.__proto__, _res)

    req.res = res
    res.req = req
    req.app = res.app = app
    next()
  })

  app.server = server;
  return app
}

var _app = {}

_app.use = function(fn) {
  _stack.push(fn)
  return this
}

_app.router = function() {
  return function router(req, res, next) {
    if(!app.route(req, res)) next()
  }
}

_app.listen = function(port, cb) {
  server = http
    .createServer(stak.apply(_app, _stack))
    .listen(port, cb)

  return server
}
