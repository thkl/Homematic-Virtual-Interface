var fs = require('fs');
var path = require('path');

var Installer = function(rootpath,main) {
	var pjson = null;
	this.rootPath = rootpath;
	this.isNPM = false
	var pjsonPath = path.join(rootpath, "package.json");
	if (fs.existsSync(pjsonPath)) {	
	try {
		var buffer = fs.readFileSync(rootpath + "/package.json");
		pjson = JSON.parse(buffer.toString());
	} catch (e) {
	    throw new Error("Path " + rootpath + " contains an invalid package.json. Error: " + err);
	}
	// check if we run as npm module
	
	if (pjson._npmVersion) {
		this.isNPM = true
		this.needsInstall = []
		this.dependencies = {}
		return
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
  	this.dependencies = pjson.dependencies;

  	if (this.dependencies) {
	  	
	  Object.keys(this.dependencies).forEach(function (dependency) {
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

Installer.prototype.checkVersions = function() {
	var that = this
	if (this.dependencies) {
	Object.keys(this.dependencies).forEach(function (dependency) {
	try {
		var buffer = fs.readFileSync(path.join(that.rootPath , "node_modules" ,  dependency ,"package.json"));
		var pjson = JSON.parse(buffer.toString());
		if (that.versionCompare(that.dependencies[dependency],pjson.version) == 1) {
			console.log("Have to update %s first (%s|%s)",dependency,that.dependencies[dependency],pjson.version);
			that.installOrUpdate(dependency)
		}
	} catch (e) {
		console.error(e)		
	}	  
	});
	}
}

Installer.prototype.installDependencies = function() {
	var that = this;
	if (this.needsInstall) {
	this.needsInstall.some(function (module){
		console.log("Have to install %s first",module);
		that.installOrUpdate(module)
	});
	}
}

Installer.prototype.installOrUpdate = function(module) {
	var that = this;
	var exec = require('child_process').exec;
	var cmd = 'npm install ' + module + ' --production --prefix "' + that.rootPath + '/"';
	require('child_process').execSync(cmd);
	console.log("Done with %s" , module);
		// reload the module
	try {
		try {
			  that.purgeCache(module);
			} catch (e) {
				console.log("Cannot purge %s this may be ok for now",module)			
			}
			var modulePath = path.join(that.rootPath , "node_modules" , module);
			var x = require(modulePath);
		    console.log("Module %s reloaded",module);
		}
		 catch (e) {
			console.log("Cant reload %s module at path %s (%s). Please do a restart",module,modulePath, e);
		}
}

/**
 * Removes a module from the cache
 */
Installer.prototype.purgeCache = function(moduleName) {
    // Traverse the cache looking for the files
    // loaded by the specified module name
    this.searchCache(moduleName, function (mod) {
        delete require.cache[mod.id];
    });

    // Remove cached paths to the module.
    // Thanks to @bentael for pointing this out.
    Object.keys(module.constructor._pathCache).forEach(function(cacheKey) {
        if (cacheKey.indexOf(moduleName)>0) {
            delete module.constructor._pathCache[cacheKey];
        }
    });
};

/**
 * Traverses the cache to search for all the cached
 * files of the specified module name
 */
Installer.prototype.searchCache = function(moduleName, callback) {
    // Resolve the module identified by the specified name
    var mod = require.resolve(moduleName);

    // Check if the module has been resolved and found within
    // the cache
    if (mod && ((mod = require.cache[mod]) !== undefined)) {
        // Recursively go over the results
        (function traverse(mod) {
            // Go over each of the module's children and
            // traverse them
            mod.children.forEach(function (child) {
                traverse(child);
            });

            // Call the specified callback providing the
            // found cached module
            callback(mod);
        }(mod));
    }
};


// used from https://gist.github.com/alexey-bass/1115557

Installer.prototype.versionCompare = function(left, right) {
    if (typeof left + typeof right != 'stringstring')
        return false;
    
    var a = left.split('.')
    ,   b = right.split('.')
    ,   i = 0, len = Math.max(a.length, b.length);
        
        
    if (a[0].indexOf("^")==0) {
	    a[0] = a[0].slice(1)
    }    
        
    for (; i < len; i++) {
        if ((a[i] && !b[i] && parseInt(a[i]) > 0) || (parseInt(a[i]) > parseInt(b[i]))) {
            return 1;
        } else if ((b[i] && !a[i] && parseInt(b[i]) > 0) || (parseInt(a[i]) < parseInt(b[i]))) {
            return -1;
        }
    }
    
    return 0;
}

module.exports = Installer;
	
