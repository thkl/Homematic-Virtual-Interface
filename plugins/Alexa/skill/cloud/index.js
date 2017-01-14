var app = require('express')();
var server = require('http').createServer(app);
var MessageServer = require(__dirname + '/msg_srv.js').MessageServer;
var clients = [];

var httpserver = new MessageServer();

var io = require('socket.io')(server);

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
					  	  client.to(message["key"]).emit('alexa', message["cmd"]);
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


