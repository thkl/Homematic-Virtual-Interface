var devicelist;

function loadHMDevices() {
		
	$("#devicelist").empty();
	
	$.getJSON( "?do=device.list", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_device('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
});
}

function loadCCUPrograms() {
	$("#devicelist").empty();
	
	$.getJSON( "?do=device.listprograms", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_device('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
});
}


function loadVirtDevices() {
		
	$("#devicelist").empty();
	
	$.getJSON( "?do=device.listvirtual", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_device('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
});
}



function select_device(key) {

	var device = devicelist[key];
	if (device) {
		console.log("Found device %s",device.name);
		document.getElementById("appliance.device_2").innerHTML = device.address	
		document.getElementById("appliance.device").value = device.address;
		document.getElementById("appliance.name").value = device.name;
		
		document.getElementById("appliance.service_2").innerHTML= device.service	
		document.getElementById("appliance.service").value = device.service;
		
		$.ajax({url: "?do=phrase.list&name="+device.name+"&service="+device.service,context: document.body}).done(function(result) {
			document.getElementById("phrase_list").innerHTML=result;	
  		});
		
	} else {
		console.log("No Device found for",key);
	}
    
}