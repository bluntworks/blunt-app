var log = require('blunt-log')
var http = require('http')
var utils = require('../lib/utils')

var req = exports = module.exports = {
  __proto__: http.IncomingMessage.prototype
}

req.get =
req.header = function(name) {
  switch(name = name.toLowerCase()) {
    case 'referer':
    case 'referrer':
      return this.headers.referrer
      || this.headers.referer
    default:
      return this.headers[name]
  }
}

req.accepts = function(type) {
  var args = arguments.length > 1
  ? [].slice.apply(arguments) : type;
  return utils.accepts(args, this.get('Accept'))
}
