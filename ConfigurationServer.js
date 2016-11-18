"use strict";

var debug = require('debug')('ConfigurationServer');
var http = require('http');
const EventEmitter = require('events');
const util = require('util');


var ConfigurationServer = function () {
  var that = this;

  function handleRequest(request, response){
    response.end('OK');
    that.emit('config_server_http_event', request);
  }

//Create a server
var server = http.createServer(handleRequest);

server.listen(8181, function(){
    debug("Configuration Server is listening on: Port 8181");
});

 EventEmitter.call(this);
}

util.inherits(ConfigurationServer, EventEmitter);


module.exports = {
  ConfigurationServer : ConfigurationServer
}
