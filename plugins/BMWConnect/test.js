const path = require('path');
const fs = require("fs");
const util = require("util");
const BMWConnectedDrive = require(path.join(__dirname , 'BMWConnectedDrive.js')).BMWConnectedDrive


console.log('Init')

let cd = new BMWConnectedDrive('yourMail','yourPass',console)
console.log('Login')
cd.login(function(){
	console.log('Login done')	
	cd.getVehicles(function(list){
		console.log(list)
		let h = list[0]
		console.log(h)
		cd.getVehicleData(h,function(data){
			console.log(h)
		})
	})
})
