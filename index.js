"use strict";

var HomematicLogicalLayer = require(__dirname + "/HomematicLogicLayer.js").HomematicLogicalLayer;
var Config = require(__dirname + '/settings.js').Config;
var ConfigServer = require(__dirname + '/ConfigurationServer.js').ConfigurationServer;
var HueBridge = require(__dirname + '/HueBridge.js').HueBridge;
var debug = require('debug')('HomematicHueBridge-Main');

const chalk = require('chalk');
const log = console.log;



log(chalk.gray("Homematic Hue Bridge"));
log(chalk.gray("2016 by thkl https://github.com/thkl/Homematic-Hue-Interface"));
log(chalk.gray("============================================================"));

var configuration = new Config();
var configServer = new ConfigServer();


var hm_layer = new HomematicLogicalLayer(configuration);
hm_layer.init();

var bridge = new HueBridge();
bridge.init(configuration,hm_layer);

configServer.on("config_server_http_event",function(command){
  var url = command.url;
  
  debug("Configuration Server Event",url);
  if (url == "/?installmode") {
    // query new devices from Hue and send them to Rega
    debug("Send my Devices to Rega");
    hm_layer.sendRPCMessage("newDevices",hm_layer.getMyDevices(), function(error, value) {});
  }

});

log(chalk.gray("hm interface layer is up and listening ...."));
 
