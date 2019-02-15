const path = require('path');
const fs = require("fs");
const util = require("util");
const BMWConnectedDrive = require(path.join(__dirname , 'BMWConnectedDrive.js')).BMWConnectedDrive

let cd = new BMWConnectedDrive('yourMail','yourPassword',console)
cd.login(function(){
	cd.getVehicles(function(list){
		if (list.length > 0) {
		let h = list[0]
			cd.getVehicleData(h,function(data){
				console.log(h)
			})
		}
	})
})
