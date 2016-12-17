//
//  VirtualDevicePlugin.js
//  Homematic Virtual Interface Core
//
//  Created by Thomas Kluge on 20.11.16.
//  Copyright © 2016 kSquare.de. All rights reserved.
//




"use strict";

/*
	Adapted from https://github.com/nfarina/homebridge
*/

var path = require('path');
var fs = require('fs');
var Logger = require(__dirname + '/Log.js').Logger;
var logger =  Logger.withPrefix("Homematic Virtual Interface.ConfigurationServer");

'use strict';

module.exports = {
  VirtualDevicePlugin: VirtualDevicePlugin
}



function VirtualDevicePlugin(pluginPath) {
  this.pluginPath = pluginPath; 
  this.initializer;
  this.instance = 0;
}

VirtualDevicePlugin.prototype.type = function() {
  return path.basename(this.pluginPath);
}

VirtualDevicePlugin.prototype.load = function(options) {
  options = options || {};
  
  // does this plugin exist at all?
  if (!fs.existsSync(this.pluginPath)) {
    throw new Error("Plugin " + this.pluginPath + " was not found. Make sure the module '" + this.pluginPath + "' is installed.");
  }
  
  // attempt to load package.json
  var pjson = VirtualDevicePlugin.loadPackageJSON(this.pluginPath);
    
    // pluck out the HomeBridge version requirement
  if (!pjson.engines || !pjson["engines"]["homematic-virtual-interface"]) {
    throw new Error("Plugin " + this.pluginPath + " does not contain the 'homematic-virtual-interface' package in 'engines'.");
  }
  
 
  // figure out the main module - index.js unless otherwise specified
  var main = pjson.main || "./index.js";

  var mainPath = path.join(this.pluginPath, main);
  
  // try to require() it and grab the exported initialization hook
  this.initializer = require(mainPath);
}

VirtualDevicePlugin.loadPackageJSON = function(pluginPath) {
  // check for a package.json
  var pjsonPath = path.join(pluginPath, "package.json");
  var pjson = null;
  if (!fs.existsSync(pjsonPath)) {
    throw new Error("Plugin " + pluginPath + " does not contain a package.json.");
  }
  
  try {
    // attempt to parse package.json
    pjson = JSON.parse(fs.readFileSync(pjsonPath));
  }
  catch (err) {
	  logger.debugger("Plugin " + pluginPath + " contains an invalid package.json. Error: " + err);
    throw new Error("Plugin " + pluginPath + " contains an invalid package.json. Error: " + err);
  }
  
  // make sure the name is prefixed with 'homematic-virtual-'
  if (!pjson.name || pjson.name.indexOf('homematic-virtual-') != 0) {
	  logger.debugger("Plugin " + pluginPath + " does not have a package name that begins with 'homematic-virtual-'.");
    throw new Error("Plugin " + pluginPath + " does not have a package name that begins with 'homematic-virtual-'.");
  }

  // verify that it's tagged with the correct keyword
  if (!pjson.keywords || pjson.keywords.indexOf("homematic-virtual-plugin") == -1) {
	  logger.debugger(" package.json does not contain the keyword 'homematic-virtual-plugin'");
    throw new Error("Plugin " + pluginPath + " package.json does not contain the keyword 'homematic-virtual-plugin'.");
  }
  
  return pjson;
}

VirtualDevicePlugin.getDefaultPaths = function() {
  var win32 = process.platform === 'win32';
  var paths = [];

  // add the paths used by require()
  paths = paths.concat(require.main.paths);

  // THIS SECTION FROM: https://github.com/yeoman/environment/blob/master/lib/resolver.js

  // Adding global npm directories
  // We tried using npm to get the global modules path, but it haven't work out
  // because of bugs in the parseable implementation of `ls` command and mostly
  // performance issues. So, we go with our best bet for now.
  if (process.env.NODE_PATH) {
    paths = process.env.NODE_PATH.split(path.delimiter)
      .filter(function(p) { return !!p; }) // trim out empty values
      .concat(paths);
  } else {
    // Default paths for each system
    if (win32) {
      paths.push(path.join(process.env.APPDATA, 'npm/node_modules'));
    } else {
      paths.push('/usr/local/lib/node_modules');
      paths.push('/usr/lib/node_modules');
     
    }
  }
  logger.debug("Adding %s/../plugins/ to path",__dirname);
  paths.push(__dirname + "/../plugins/");
  return paths;
}

// All search paths we will use to discover installed plugins
VirtualDevicePlugin.paths = VirtualDevicePlugin.getDefaultPaths();

VirtualDevicePlugin.addPluginPath = function(pluginPath) {
  VirtualDevicePlugin.paths.unshift(path.resolve(process.cwd(), pluginPath));
}

// Gets all plugins installed on the local system
VirtualDevicePlugin.installed = function() {

  var plugins = [];
  var pluginsByName = {}; // don't add duplicate plugins
  var searchedPaths = {}; // don't search the same paths twice
  
  // search for plugins among all known paths, in order
  logger.debug("Plugin Paths :", VirtualDevicePlugin.paths);
  for (var index in VirtualDevicePlugin.paths) {
    var requirePath = VirtualDevicePlugin.paths[index];
    
    // did we already search this path?
    if (searchedPaths[requirePath])
      continue;
      
    searchedPaths[requirePath] = true;
    
    // just because this path is in require.main.paths doesn't mean it necessarily exists!
    if (!fs.existsSync(requirePath))
      continue;

    var names = fs.readdirSync(requirePath);

    // does this path point inside a single plugin and not a directory containing plugins?
    
    if (fs.existsSync(path.join(requirePath, "package.json")))
      names = [""];
    
    // read through each directory in this node_modules folder
    for (var index2 in names) {
      var type = names[index2];
    
      // reconstruct full path
      var pluginPath = path.join(requirePath, type);
    
      // we only care about directories
      if (!fs.statSync(pluginPath).isDirectory()) continue;

      
      // does this module contain a package.json?
      var pjson;
      try {
        // throws an Error if this isn't a homematic-virtual plugin
        pjson = VirtualDevicePlugin.loadPackageJSON(pluginPath);
      }
      catch (err) {
        // is this "trying" to be a homematic-virtual plugin? if so let you know what went wrong.
        if (!type || type.indexOf('homematic-virtual-') == 0) {
          logger.error(err.message);
        }
        
        // skip this module
        continue;
      }
      
      // get actual name if this path points inside a single plugin
      if (!type) type = pjson.name;
      // Check if we need that plugin 
      
      // add it to the return list
      if (!pluginsByName[type]) {
        pluginsByName[type] = pluginPath;
        plugins.push(new VirtualDevicePlugin(pluginPath));
      }
      else {
        logger.warn("Warning: skipping plugin found at '" + pluginPath + "' since we already loaded the same plugin from '" + pluginsByName[name] + "'.");
      }
    }
  }
  
  return plugins;
}