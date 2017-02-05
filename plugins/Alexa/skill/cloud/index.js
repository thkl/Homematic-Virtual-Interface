var app = require('express')();
var https = require('https');
var fs = require('fs');

var MessageServer = require(__dirname + '/msg_srv.js').MessageServer;
var clients = [];

var httpserver = new MessageServer();

var options = {
  key: fs.readFileSync('/root/.acme.sh/ksquare.de/ksquare.de.key'),
  cert: fs.readFileSync('/root/.acme.sh/ksquare.de/ksquare.de.cer')
};

var serverPort = 443;
var server = https.createServer(options, app);
var io = require('socket.io')(server);

function authenticate(socket, data, callback) {
  var username = data.username;
  var password = data.password;
 
  return callback(null, username == password);

}

function postAuthenticate(socket, data) {
 
   socket.join(data.username);
 
}

function disconnect(socket) {
  console.log(socket.id + ' disconnected');
}

require('socketio-auth')(io, {
  authenticate: authenticate,
  postAuthenticate: postAuthenticate,
  disconnect: disconnect,
  timeout: 4000
});


io.on('connection', function(client){
  client.on('event', function(data){
	  
	  console.log("Client ID %s",client.id);
	//  clients.push(client)
		  
  });
  
  client.on('disconnect', function(){
	  
  });
  
  client.on('message', function(data,fn){
	  
	  console.log("Message %s from client %s",data,client.id);
	  try {
		  
		  var message = JSON.parse(data);
		  if (message) {
			  
			  Object.keys(message).forEach(function (key) {
				  
				  switch (key) {
					  
					  case "key": {
						  client.join(message["key"]);
					  }
					  break;
					  
					  case "cmd": 
					  {
						  client.join(message["key"]);
					  	  client.to(message["key"]).emit(message["key"], message["cmd"]);
					  }

					  case "result": 
					  {
						  client.join(message["key"]);
					  	  client.to(message["key"]).emit('result', message["result"]);
					  }
					  
					  
					  break;
					  
				  }
				  
			  });
			  
		  }
		  
	  }	  catch (e) {
		  
	  }
  });
  
});

server.listen(3000);


