
var http = require('http');
var qs = require('querystring');
var port = 53001;

var clients = [];

var MessageServer = function () {


function handleRequest(request, response){

    var message = "+OK";

	if (request.method == 'POST') {
        	var body = '';

			request.on('data', function (data) {
           	 body += data;

		   	 if (body.length > 1e6)
             	   request.connection.destroy();
        	 });

			 request.on('end', function () {
				console.log("END");
				var post = qs.parse(body);
				console.log(JSON.stringify(post));
			 	var api_key = post["api_key"];
			 	var command = post["cmd"];
			 	if (api_key) {
				 	console.log("Key Found open socket");
				// create a socketIO Client and join the api key channel
					var client = require('socket.io-client')('http://localhost:3000');
					clients.push(client);
					
					client.on('connect', function () {						
						client.send(JSON.stringify({"key":api_key,"cmd":command}), function (data) {
						
						});
    				});

					client.on('result', function (data) {	
						message = JSON.stringify(data);
						console.log("Disconnect remove %s from Clients",client.id);
						
						response.writeHead(200, {
							'Content-Length': Buffer.byteLength(message),
							'Content-Type': 'text/html' });
							response.end(message);


						var index = clients.indexOf(client);
						if (index > -1) {
							clients.splice(index, 1);
						}

					});
					
					
					
					console.log("We have now %s clients",clients.length);
			 	}
			 });
    }
        
 
    };


var server = http.createServer(handleRequest);
 
server.listen(port, function(){
		console.log("Message Server is listening on: Port %s",port);
});	

}


module.exports = {
  MessageServer : MessageServer
}
