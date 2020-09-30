'use strict'

//
//  ConfigurationServer.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//
/* eslint-disable handle-callback-err */
/* eslint-disable no-inner-declarations */

var http = require('http')
var https = require('https')
const fs = require('fs')
const Url = require('url')
const path = require('path')

const EventEmitter = require('events')
const util = require('util')
var logger = require(path.join(__dirname, '/logger.js')).logger('ConfigurationServer')
var qs = require('querystring')

var globalconfig
var crypto = require('crypto')

var contentTypesByExtension = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.gif': 'image/gid',
  '.gz': 'application/gzip',
  '.ico': 'image/x-icon'
}

var ConfigurationServer = function (config) {
  this.config = config
  this.port = config.getValueWithDefault('web_http_port', 8182)
  this.init()
  this.useAuth = config.getValueWithDefault('use_http_auth', false)
  this.passwd = config.getValueWithDefault('http_auth_pwd', crypto.createHash('md5').update('admin').digest('hex'))
  globalconfig = config
  EventEmitter.call(this)
}

util.inherits(ConfigurationServer, EventEmitter)

ConfigurationServer.prototype.init = function () {
  var that = this

  this.isPortTaken(this.port, function (error, inUse) {
    if (inUse === false) {
      logger.debug('Configuration Server Initializing on Port %s', that.port)

      function handleRequest (request, response) {
        if (that.useAuth === true) {
          let auth = request.headers['authorization']
          if (!auth) {
            response.statusCode = 401
            response.setHeader('WWW-Authenticate', 'Basic realm="HVL"')
            response.end('<html><body>Need some creds son</body></html>')
            return
          } else if (auth) {
            let tmp = auth.split(' ')
            if (tmp.length > 1) {
              if (tmp[0] === 'Basic') {
                let buf = Buffer.from(tmp[1], 'base64')
                let plainAuth = buf.toString()
                let creds = plainAuth.split(':')
                let username = creds[0]
                let password = crypto.createHash('md5').update(creds[1]).digest('hex')

                if ((username === 'admin') && (password === that.passwd)) {
                  response.statusCode = 200 // OK
                } else {
                  response.statusCode = 401
                  response.setHeader('WWW-Authenticate', 'Basic realm="HVL"')
                  response.end('<html><body>Need some creds son</body></html>')
                  return
                }
              } else {
                response.statusCode = 401
                response.setHeader('WWW-Authenticate', 'Basic realm="HVL"')
                response.end('<html><body>Wrong authentication method</body></html>')
                return
              }
            }
          }
        }

        if (request.method === 'POST') {
          var body = ''

          request.on('data', function (data) {
            body += data

            if (body.length > 1e6) {
              request.connection.destroy()
            }
          })

          request.on('end', function () {
            var post = qs.parse(body)
            var dispatched_request = new DispatchedRequest(request, response)
            dispatched_request.post = post
            that.emit('config_server_http_event', dispatched_request)
          })
        } else {
          var dispatched_request = new DispatchedRequest(request, response)
          that.emit('config_server_http_event', dispatched_request)
        }
      };

      if (that.config.getValueWithDefault('use_https', false) === false) {
        // Create a server
        that.server = http.createServer(handleRequest)
        that.server.listen(that.port, function () {
          logger.info('Configuration Server is listening on: Port %s', that.port)
        })
      } else {
        logger.info('Will use secure config server')
        that.config.httpsCertificates(function (cert) {
          that.server = https.createServer(cert, handleRequest)
          that.server.listen(that.port, function () {
            logger.info('Secure configuration server is listening on: Port %s', that.port)
          })
        })
      }
    } else {
      logger.error('WebService can not run on  Port %s cause this port is in use. Please make sure that the layer isnt running at the moment.', that.port)
    }
  })
}

ConfigurationServer.prototype.shutdown = function () {
  logger.info('Configuration Server Shutdown')
  if (this.server !== undefined) {
    this.server.close()
  }
}

ConfigurationServer.prototype.isPortTaken = function (port, fn) {
  var net = require('net')
  var tester = net.createServer().once('error', function (err) {
    if (err.code !== 'EADDRINUSE') return fn(err)
    fn(null, true)
  })
    .once('listening', function () {
      tester.once('close', function () {
        fn(null, false)
      })
        .close()
    }).listen(port)
}

var DispatchedRequest = function (request, response) {
  this.request = request
  this.response = response
  this.request_paths = []

  var supportedLng = ['de-de', 'en-en']

  this.language = 'en-en'

  var lnh = this.request.headers['accept-language']
  if (lnh) {
    if (supportedLng.indexOf(lnh) > -1) {
      this.language = lnh.toLowerCase()
    }
  }

  // Parse the path
  var parsed = new Url.URL(request.url, 'http://localhost')
  this.request_pathname = parsed
  if ((parsed !== undefined) && (parsed.pathname)) {
    this.request_paths = parsed.pathname.split(path.sep)
  } else {
    console.log(parsed)
    this.request_paths = []
    this.request_paths.push(request.url)
  }
}

DispatchedRequest.prototype.localizedTemplate = function (filepath, file) {
  var loc_filename = path.join(filepath, 'www') + '/' + this.language + '/' + file
  if (fs.existsSync(loc_filename)) {
    return loc_filename
  } else {
    return path.join(filepath, 'www') + '/' + file
  }
}

// do it syncronous
DispatchedRequest.prototype.getTemplate = function (filepath, file, replacements) {
  var filename

  if ((filepath == null) || (filepath === undefined)) {
    filepath = path.join(__dirname, '..')
  }

  // filename = path.join(filepath, "www") + "/" + file;

  filename = this.localizedTemplate(filepath, file)

  try {
    fs.accessSync(filename, fs.F_OK)
    if (fs.statSync(filename).isDirectory()) filename += '/index.html'
    file = fs.readFileSync(filename, 'binary')

    var contentType = contentTypesByExtension[path.extname(filename)]
    if ((contentType === 'text/html') && (replacements !== undefined)) {
      var keys = Object.keys(replacements)
      file = file.toString('utf8')
      keys.forEach(function (key) {
        file = file.replace('$' + key + '$', replacements[key])
      })
    }
    return file
  } catch (e) {
    logger.debug('File %s not found. (%s)', filename, e)
    return ' Template not found'
  }
}

DispatchedRequest.prototype.fillTemplate = function (template, replacements) {
  if (replacements) {
    var keys = Object.keys(replacements)
    template = template.toString('utf8')
    keys.map(function (key) {
      var replacement = replacements[key]
      if ((typeof replacement === 'string') || (typeof replacement === 'number')) {
        template = template.split('$' + key + '$').join(replacement)
      }

      if (typeof replacement === 'object') {
        var repkeys = Object.keys(replacement)
        repkeys.map(function (repkey) {
          template = template.split('$' + key + '.' + repkey + '$').join(replacement[repkey])
        })
      }
    })
  }
  return template
}

DispatchedRequest.prototype.dispatchFile = function (filepath, thefile, replacements) {
  var that = this

  var filename
  if (thefile.indexOf('/tmp') === 0) {
    filename = path.join(globalconfig.storagePath(), path.basename(thefile))
  } else {
    if ((filepath == null) || (filepath === undefined)) {
      filepath = path.join(__dirname, '..')
    }

    if (filepath.indexOf('/tmp') === 0) {
      filename = path.join(filepath, thefile)
    } else {
      filename = this.localizedTemplate(filepath, thefile)
    }
  }

  try {
    fs.exists(filename, function (exists) {
      if (!exists) {
        that.response.writeHead(404, {
          'Content-Type': 'text/plain'
        })
        that.response.write('404 Not Found\n')
        that.response.end()
        logger.warn('%s not found', filename)
        return
      }

      if (fs.statSync(filename).isDirectory()) filename += '/index.html'

      fs.readFile(filename, 'binary', function (err, file) {
        if (err) {
          that.response.writeHead(500, {
            'Content-Type': 'text/plain'
          })
          that.response.write(err + '\n')
          that.response.end()
          return
        }

        var mode = 'utf-8'
        var headers = {}
        var contentType = contentTypesByExtension[path.extname(filename)]
        if (contentType) {
          if (contentType) headers['Content-Type'] = contentType
          if (contentType.indexOf('utf-8') === -1) {
            mode = 'binary'
          }

          if (contentType.indexOf('application/gzip') === 0) {
            headers['Content-Disposition'] = 'attachment; filename="' + thefile + '"'
          }

          if ((contentType.indexOf('text/html') > -1) || ((contentType.indexOf('application/json') > -1) && (replacements !== undefined))) {
            file = that.fillTemplate(file, replacements)
          }
        } else {
          logger.warn('unknow content type for %s this is a serious bug', filename)
        }
        try {
          that.response.writeHead(200, headers)
          if (!that.response.finished) {
            that.response.write(file, mode)
          }
          that.response.end()
        } catch (e1) {
          logger.info(JSON.stringify(headers))
          logger.warn('Error while sending back http %s', e1)
        }
      })
    })
  } catch (e) {
    logger.debug('File %s not found. (%s)', filename, e)
    that.response.writeHead(500, {
      'Content-Type': 'text/plain'
    })
    that.response.write(e + '\n')
    that.response.end()
  }
}

DispatchedRequest.prototype.dispatchMessage = function (message) {
  this.response.writeHead(200, {
    'Content-Length': Buffer.byteLength(message),
    'Content-Type': 'text/html'
  })
  this.response.end(message)
}

DispatchedRequest.prototype.dispatchData = function (data, mimetype) {
  this.response.writeHead(200, {
    'Content-Length': Buffer.byteLength(data),
    'Content-Type': mimetype
  })
  this.response.end(data)
}

DispatchedRequest.prototype.redirectTo = function (newUrl) {
  this.response.writeHead(302, {
    'Location': newUrl
  })
  this.response.end()
}

module.exports = {
  ConfigurationServer: ConfigurationServer,
  DispatchedRequest: DispatchedRequest

}
