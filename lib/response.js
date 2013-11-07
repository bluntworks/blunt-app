var log = require('blunt-log')
var http = require('http')
var crc32 = require('buffer-crc32')
var mime = require('send').mime

var utils = require('../lib/utils.js')
var normType = utils.normalizeType
var normTypes = utils.normalizeTypes
var statusCodes = http.STATUS_CODES

var sign = require('cookie-signature')
var cookie = require('cookie')
var merge  = require('../lib/merge.js')

var res = exports = module.exports = {
  __proto__: http.ServerResponse.prototype
}

res.send = function(o) {
  log('res send', o)
}

res.set =
res.header = function(fld, val) {
  if(2 == arguments.length) {
    if(Array.isArray(val)) val = val.map(String)
    else val = String(val)
    this.setHeader(fld, val)
  } else {
    for(var k in fld) this.set(k, fld[k])
  }
}

res.get = function(fld) {
  return this.getHeader(fld)
}

res.send = function(body) {
  var req = this.req
  var head = 'HEAD' === req.method
  var len

  if(2 == arguments.length) {
    if('number' != typeof body && 'number' == typeof arguments[1]) {
      this.statusCode = arguments[1]
    } else {
      this.statusCode = body
      body = arguments[1]
    }
  }

  switch(typeof body) {
    case 'number':
      this.get('Content-Type') || this.type('text')
      this.statusCode = body
      body = http.STATUS_CODES[body]
      break
    case 'string':
      if(!this.get('Content-Type')) {
        this.charset = this.charset || 'utf-8'
        this.type('html')
      }
      break
    case 'boolean':
    case 'object':
      if(null == body) body = ''
      else if(Buffer.isBuffer(body)) this.get('Content-Type') || this.type('bin')
      else return this.json(body)
      break
    }

    if(undefined !== body && !this.get('Content-Length')) {
      this.set('Content-Length', len = Buffer.isBuffer(body)
        ? body.length
        : Buffer.byteLength(body))
    }

    if(len > 1024 && 'GET' == req.method) {
      if(!this.get('ETag'))
        this.set('ETag', '"' + crc32.signed(body) + '"')
    }

    if(req.fresh) this.statusCode = 304

    if(204 == this.statusCode || 304 == this.statusCode) {
      this.removeHeader('Content-Type')
      this.removeHeader('Conetnt-Length')
      this.removeHeader('Transfer-Encoding')
      body = ''
    }

    this.end(head ? null : body)

    return this
}

res.json = function(o) {
  if(2 == arguments.length) {
    ('number' == typeof arguments[1]) 
      ? this.statusCode = arguments[1]
      : this.statusCode = o, o = arguments[1];
  }
  var body =  JSON.stringify(o)
  this.charset = this.charset || 'utf-8'
  this.get('Content-Type') || this.set('Content-Type', 'application/json')
  return this.send(body)
}

res.contentType =
res.type = function(type) {
  return this.set('Conetnt-Type', ~type.indexOf('/')
    ? type
    : mime.lookup(type))
}


res.format = function(o) {
  var req = this.req
  var next = req.next

  var fn = o.default
  if(fn) delete o.default
  var keys = Object.keys(o)
  var key = req.accepts(keys)

  this.vary('Accepts')

  if(key) {
    this.set('Content-Type', normType(key).value)
    o[key](req, this, next)
  } else if(fn) {
    fn()
  } else {
    var err = new Error('Not Acceptable')
    err.status = 406
    err.types = normTypes(keys).map(function(k) { return k.value })
    next(err)
  }

   return this
}


res.redirect = function(url) {
  var app = this.app
  var head = 'HEAD' == this.req.method
  var status = 302
  var body

  if(2 == arguments.length) {
    ('number' !== typeof url)
      ? status = arguments[1]
      : status = url, url = arguments[1]
  }

  this.location(url)
  url = this.get('Location')

  this.format({
    text: function() {
      body = statusCodes[status] + '. Redirecting to ' + encodeURI(url);
    },

    html: function() {
      var u = utils.escape(url)
      body = '<p>' + statusCodes[status] + '. Redirecting to <a href="' + u + '" >' + u + '</a></p>';
    },

    default: function() { body = '' }
  })

  this.statusCode = status
  this.set('Content-Length', Buffer.byteLength(body))
  this.end(head ? null : body)
}

res.location = function(url) {
  var req = this.req
  var app = this.app

  var map = { back: req.get('Referrer') || '/' }

  url = map[url] || url

  if(!~url.indexOf('://') && 0 != url.indexOf('//')) {
    var path
    if('.' == url[0]) {
      path = req.originalUrl.split('?')[0]
      url = path + ('/' == path[path.length -1] ? '' : '/') + url
    } else if('/' != url[0]) {
      path = app.path()
      url = path + '/' + url
    }
  }

  this.set('Location', url)
  return this
}

res.vary = function(fld) {
  var self = this
  if(!fld) return this

  if(Array.isArray(fld))
    fld.forEach(function(f) { self.vary(f) })

  var vary = this.get('Vary')
  if(vary) {
    vary = vary.split(/ *, */)
    if(!~vary.indexOf(fld)) vary.push(fld)
    this.set('Vary', vary.join(', '))
    return this
  }

  this.set('Vary', fld)
  return this
}

res.clearCookie = function(name, ops) {
  var o = { expires: new Date(1), path: '/' }
  return this.cookie(name, '', ops ? merge(o, ops) : o)
}

res.cookie = function(name, val, ops) {
  ops = merge({}, ops)
  var secret = this.req.secret
  var signed = ops.signed
  if(signed && !secret) throw new Error('connect.cookieParser("secret") required for signed cookie')
  if('number' ==  typeof val) val = val.toString()
  if('object' == typeof val) val = 'j:' + JSON.stringify(val)
  if(signed) val = 's:' + sign(val, secret)
  if('maxAge' in ops) {
    ops.expires = new Date(Date.now() + ops.maxAge)
    ops.maxAge /= 1000
  }
  if(null == ops.path) ops.path = '/'
  this.set('Set-Cookie', cookie.serialize(name, String(val), ops))
  return this
}












