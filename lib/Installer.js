var fs = require('fs');
var path = require('path');

var Installer = function(rootpath,main) {
	var pjson = null;
	this.rootPath = rootpath;
	var pjsonPath = path.join(rootpath, "package.json");
	if (fs.existsSync(pjsonPath)) {	
	try {
		var buffer = fs.readFileSync(rootpath + "/package.json");
		pjson = JSON.parse(buffer.toString());
	} catch (e) {
	    throw new Error("Path " + rootpath + " contains an invalid package.json. Error: " + err);
	}
	
	if (!main) {
		if (pjson != null) {
		// make sure the name is prefixed with 'homematic-virtual-'
		if (!pjson.name || pjson.name.indexOf('homematic-virtual-') != 0) {
	    	throw new Error("Path " + rootpath + " does not have a package name that begins with 'homematic-virtual-'.");
  		}

  		// verify that it's tagged with the correct keyword
  		if (!pjson.keywords || pjson.keywords.indexOf("homematic-virtual-plugin") == -1) {
			throw new Error("Path " + rootpath + " package.json does not contain the keyword 'homematic-virtual-plugin'.");
  		}
  		}
    }
  	
  	var needsInstall = [];
  	// Check dependencies
  	var dependencies = pjson.dependencies;

  	if (dependencies) {
	  	
	  Object.keys(dependencies).forEach(function (dependency) {
		try {
			var x = require(rootpath + "/node_modules/" +  dependency);
	  	} catch (e) {
		 	needsInstall.push(dependency);
		}	  
	  });
  	}	

	}
	
	this.needsInstall = needsInstall;
}

Installer.prototype.installDependencies = function() {
	var that = this;
	var exec = require('child_process').exec;
	if (this.needsInstall) {
	this.needsInstall.some(function (module){
		console.log("Have to install %s first",module);
		var cmd = 'npm install ' + module + ' --production --prefix "' + that.rootPath + '/"';
        require('child_process').execSync(cmd);
		console.log("Done with %s" , module);
	});
	}
}

module.exports = Installer;
	
