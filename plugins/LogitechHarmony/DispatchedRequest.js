//
//  DispatchRequest.js
//  Homematic Virtual Interface Plugin
//
//  Created by Thomas Kluge on 09.12.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//


"use strict";

var querystring = require('querystring');
const util = require('util');
var url = require("url");

var DispatchedRequest = function (request,response) {
	this.method = request.method;
	this.request = request;
	this.response = response;
	this.requesturl = request.url;
	this.queryObject = url.parse(request.url,true);
	this.queryPath = this.queryObject.pathname;
	this.queryComponents = this.queryPath.split("/");
}


DispatchedRequest.prototype.sendResponse = function(jsonObject) {
	var message = JSON.stringify(jsonObject);
	this.response.writeHead(200, {
			'Content-Length': Buffer.byteLength(message),
			'Content-Type': 'application/json' });
	this.response.end(message);
}

DispatchedRequest.prototype.sendXMLResponse = function(message) {
	this.response.writeHead(200, {
			'Content-Length': Buffer.byteLength(message),
			'Content-Type': 'text/xml' });
	this.response.end(message);
}


DispatchedRequest.prototype.sendTextResponse = function(message) {
	this.response.writeHead(200, {
			'Content-Length': Buffer.byteLength(message),
			'Content-Type': 'text/html' });
	this.response.end(message);
}


DispatchedRequest.prototype.processPost = function(callback) {
    var that = this;
    var queryData = "";
    
    if(typeof callback !== 'function') return null;

    if ((this.request.method == 'POST') || (this.request.method == 'PUT')) {
        this.request.on('data', function(data) {
            queryData += data;
            if(queryData.length > 1e6) {
                queryData = "";
                response.writeHead(413, {'Content-Type': 'text/plain'}).end();
                that.request.connection.destroy();
            }
        });

        that.request.on('end', function() {
            that.request.post = querystring.parse(queryData);
            callback();
        });

    } else {
        that.response.writeHead(405, {'Content-Type': 'text/plain'});
        that.response.end();
    }
}


module.exports = {
  DispatchedRequest : DispatchedRequest
}