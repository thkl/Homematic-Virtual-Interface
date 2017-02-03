var devicelist;

function loadHMDevices() {
		
	$("#devicelist").empty();
	
	$.getJSON( "?do=device.list", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"',false)\">" + val.device + " / " + val.name + "</a></li>" );
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
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"',true)\">" + val.device + " / " + val.name + "</a></li>" );
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
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"',false)\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
});
}



function select_item(key,program) {
	var device = devicelist[key];
	if ((device) && (device.service.length>0)) {
		console.log("Found device %s",device.name);
		if (program==true) {
			document.getElementById("appliance.device_2").innerHTML = device.name	
		} else {
			document.getElementById("appliance.device_2").innerHTML = device.address	
		}
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