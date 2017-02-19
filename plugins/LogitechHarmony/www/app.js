var devicelist;
var selectedtype;

function loadObjects() {
		
	$("#devicelist").empty();
	
	if ($("#type").val()==3) {

	selectedtype = 3;
	$.getJSON( "?do=device.list", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
	});


		
	}
	
	if ($("#type").val()==4) {

	selectedtype = 4;
	$.getJSON( "?do=device.listprograms", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
	});
		
		
	}


	if ($("#type").val()==5) {

	selectedtype=5;
	$.getJSON( "?do=device.listvariables", function( data ) {
	var items = [];
		devicelist = data;
		$.each( data, function( key, val ) {
			items.push( "<li id='" + key + "'><a href='#' onClick=\"select_item('"+key+"')\">" + val.device + " / " + val.name + "</a></li>" );
  	});
 
  	var list = $( "<ul/>", {
    	"class": "my-new-list",
		html: items.join( "" )
  	});
  	$("#devicelist").append($("<div>",{"class":"ph"}).append(list));
	});
		
		
	}
	
	
}

function select_item(key) {
	var device = devicelist[key];
	if (device) {
		if ((selectedtype==4) || (selectedtype==5)) {
			document.getElementById("device.device_2").innerHTML = device.name	
		} else {
			document.getElementById("device.device_2").innerHTML = device.address	
			document.getElementById("device.ctype").value = device.type;
		}
		document.getElementById("device.adress").value = device.address;
		document.getElementById("device.name").value = device.name;
		
	} else {
		console.log("No Device found for",key);
	}
}