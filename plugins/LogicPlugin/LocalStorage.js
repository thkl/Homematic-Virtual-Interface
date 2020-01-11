const path = require('path')
const fs = require('fs')
const util = require('util')
const EventEmitter = require('events')

var DeviceImporter = function(database, rega, logger) {
    this.rega = rega
    this.database = database
    this.logger = logger
}

DeviceImporter.prototype.run = function(hm_layer, callback) {
    let that = this
    that.logger.info('Creating tables')
    that.database.prepare('CREATE TABLE if not exists "devices" ("name" varchar,"address" varchar,"type" varchar,"interface" varchar, "regaid" integer, PRIMARY KEY ("regaid"));').run()
    that.database.prepare('CREATE TABLE if not exists "channels" ("device" integer ,"regaid" integer,"address" varchar,"type" varchar,"name" varchar,"index" integer,"internal" int,"direction" int,"archive" int,"visible" int,"acl" int, PRIMARY KEY (regaid));').run()
    that.database.prepare('CREATE TABLE if not exists "datapoints" ("regaid" integer,"channel" integer,"name" varchar,"address" varchar,"internal" integer,"operations" integer,"type" varchar,"vstype" integer,"vtype" integer,"unit" varchar, PRIMARY KEY (regaid));').run()
    var fetchDevices = 'string sDevId;string sChnId;string sDpId;Write("{\\"devices\\":");Write("[");boolean dFirst = true;foreach (sDevId, root.Devices().EnumUsedIDs()) {'
    fetchDevices = fetchDevices + 'object oDevice   = dom.GetObject(sDevId);if (dFirst) {dFirst = false;} else {WriteLine(",");}Write("{\\"id\\": " # sDevId # ", \\"address\\": \\"" # oDevice.Address() # "\\", \\"name\\": \\"" # oDevice.Name() # "\\",\\"ready\\": \\"" # oDevice.ReadyConfig() # "\\",");var inf = dom.GetObject(oDevice.Interface());if (inf) {Write("\\"ifid\\": " # oDevice.Interface() # ", \\"ifname\\": \\"" # inf.Name() # "\\",");}Write("\\"type\\": \\"" # oDevice.HssType() # "\\",  \\"visible\\": " # oDevice.Visible().ToString() # ", \\"ready\\": " # oDevice.ReadyConfig().ToString() # ",");'
    fetchDevices = fetchDevices + 'Write("\\"channels\\":[");boolean cFirst = true;foreach(sChnId, oDevice.Channels()) {object oChannel = dom.GetObject(sChnId);if (cFirst) {cFirst = false;} else {WriteLine(",");}Write("{\\"id\\": " # sChnId # ", \\"address\\": \\"" # oChannel.Address() # "\\", \\"name\\":\\"" # oChannel.Name() # "\\",");Write("\\"index\\": " # oChannel.ChnNumber().ToString() # ", \\"internal\\": " # oChannel.Internal().ToString() # ", \\"channeltype\\": \\"" # oChannel.ChannelType() # "\\", \\"type\\": \\"" # oChannel.HssType() # "\\", \\"aes\\": " # oChannel.ChnAESActive().ToString() # ", \\"dir\\":" # oChannel.ChnDirection() # ",");Write("\\"archive\\": " # oChannel.ChnArchive().ToString() # ", \\"visible\\": " # oChannel.Visible().ToString() # ", \\"rights\\":\\"" # oChannel.UserAccessRights(iulOtherThanAdmin).ToString() # "\\",");boolean dpFirst = true;'
    fetchDevices = fetchDevices + 'Write("\\"dp\\":[");if (oChannel.ChnDirection()==2) {object oDP = oChannel.DPByHssDP("WORKING");if (oDP) {dpFirst = false;Write("{\\"id\\": " # oDP.ID() # ", \\"name\\": \\"" # oDP.Name().StrValueByIndex(".", 2) # "\\", \\"address\\":\\"" # oDP.Name() # "\\",");Write(" \\"type\\": \\"" # oDP.TypeName() # "\\", \\"operations\\": " # oDP.Operations() # ",");Write("\\"internal\\": " # oDP.Internal().ToString() # ", \\"vtype\\": " # oDP.ValueType() # ", \\"vstype\\": " # oDP.ValueSubType() # "}");}}foreach(sDpId, oChannel.DPs().EnumUsedIDs()) {object oDP = dom.GetObject(sDpId);if (dpFirst) {dpFirst = false;} else {WriteLine(",");}Write("{\\"id\\": " # sDpId # ", \\"name\\": \\"" # oDP.Name().StrValueByIndex(".", 2) # "\\", \\"address\\":\\"" # oDP.Name() # "\\",");Write(" \\"internal\\": " # oDP.Internal().ToString() # ", \\"type\\": \\"" # oDP.TypeName() # "\\", \\"operations\\": " # oDP.Operations() # ",");if (oDP.ValueUnit() != "") {Write("\\"vunit\\":\\"");WriteURL(oDP.ValueUnit());Write("\\",");}Write("\\"vtype\\": " # oDP.ValueType() # ", \\"vstype\\": " # oDP.ValueSubType() # "}");}Write("]}");}Write("]}");}Write("]}");'
    const Rega = this.rega
    let rr = new Rega(hm_layer, fetchDevices, function(result) {
        that.logger.info("Rega result fetched")
        let dbid = 'INSERT INTO "devices" ("regaid", "name", "address", "type", "interface") VALUES (@regaid,@name,@address,@type,@interface);'
        let dbic = 'INSERT INTO "channels" ("device", "regaid", "address", "type", "name", "index", "internal", "direction", "archive", "visible", "acl") VALUES (@device,@regaid,@address,@type,@name,@index,@internal,@direction,@archive,@visible,@acl);'
        let dbidp = 'INSERT INTO "datapoints" ("regaid", "channel", "name", "address", "internal", "operations", "type", "vstype", "vtype", "unit") VALUES (@id, @cid, @name, @address,@internal,@operations,@type,@vstype,@vtype,@vunit);'

        let odBInsertDevice = that.database.prepare(dbid)
        let insertDevices = that.database.transaction(devices => {
            for (const device of devices) odBInsertDevice.run(device);
        })
        var devinserts = []

        let odBInsertChannel = that.database.prepare(dbic)
        let insertChannels = that.database.transaction(channels => {
            for (const channel of channels) odBInsertChannel.run(channel);
        })
        var chainserts = []


        let odBInsertDatapoint = that.database.prepare(dbidp)
        let insertDataPoints = that.database.transaction(datapoints => {
            for (const dp of datapoints) odBInsertDatapoint.run(dp);
        })
        var dpinserts = []


        let oResult = JSON.parse(result)
        if ((oResult) && (oResult.devices)) {
            that.logger.info('Build (%s) Devices', oResult.devices.length)
            oResult.devices.forEach(device => {
                that.logger.debug("Adding (%s) %s", device.id, device.name)
                devinserts.push({
                    regaid: device.id,
                    name: device.name,
                    address: device.address,
                    type: device.type,
                    interface: device.ifname
                })

                device.channels.forEach(channel => {

                        chainserts.push({
                            device: device.id,
                            regaid: channel.id,
                            address: channel.address,
                            type: channel.type,
                            name: channel.name,
                            index: channel.index,
                            internal: channel.internal ? 0 : 1,
                            direction: channel.dir,
                            archive: channel.archive ? 0 : 1,
                            visible: channel.visible ? 0 : 1,
                            acl: channel.rights
                        })

                        channel.dp.forEach(datapoint => {
                                dpinserts.push({
                                    id: datapoint.id,
                                    cid: channel.id,
                                    name: datapoint.name,
                                    address: datapoint.address,
                                    internal: datapoint.internal ? 0 : 1,
                                    operations: datapoint.operations,
                                    type: datapoint.type,
                                    vstype: datapoint.vstype,
                                    vtype: datapoint.vtype,
                                    vunit: datapoint.vunit ||  ''
                                })
                            }) // end foreach dp
                            // run insert DB Transaction
                    }) // End foreach channel
            })
            that.logger.info("Committing to devices to filedb")
            insertDevices(devinserts)
            insertChannels(chainserts)
            insertDataPoints(dpinserts)
            that.logger.debug("done")
        } else  {
            that.logger.error("No devices in result")
        }

        if (callback) {
            callback()
        }
    })
}

var RoomImporter = function(database, rega, logger) {
    this.database = database
    this.rega = rega
    this.logger = logger
    this.database.prepare('CREATE TABLE if not exists "groups" ("regaid" integer,"name" varchar,"type" varchar, PRIMARY KEY ("regaid"));').run()
    this.database.prepare('CREATE TABLE if not exists "groupitems" ("id" INTEGER PRIMARY KEY,"groupid" integer,"regaid" integer);').run()
}

RoomImporter.prototype.run = function(hm_layer, type, callback) {
    let that = this
    const Rega = this.rega
    that.logger.info('Build Group %s', type)
    let fetchGroups = 'Write("{\\"items\\":[");var roomVar=dom.GetObject(ID_' + type + 'S);string rid;string sChannelId;string cid;boolean df = true;foreach(rid, dom.GetObject(ID_' + type + 'S).EnumIDs()){var roomObj = dom.GetObject(rid);if(df) {df = false;} else { Write(",");}Write("{");Write("\\"id\\":"#rid#",");Write("\\"name\\":\\"" # roomObj.Name() # "\\","); Write("\\"channels\\":[");boolean df1 = true;foreach(cid, roomObj.EnumUsedIDs()){if(df1) {df1 = false;} else { Write(",");}Write(cid);}Write("]");Write("}");}Write("]}");'
    let rr = new Rega(hm_layer, fetchGroups, function(result) {
        let dbir = 'INSERT INTO  "groups" ("regaid", "name", "type") VALUES (@regaid, @name, @type);'
        let ditr = 'INSERT INTO "groupitems" ("groupid","regaid") VALUES(@groupid,@regaid);'

        let odBInsertGroup = that.database.prepare(dbir)
        let insertGroup = that.database.transaction(groups => {
            for (const group of groups) odBInsertGroup.run(group);
        })
        var grpinserts = []

        let odBInsertGroupItem = that.database.prepare(ditr)
        let insertGroupItem = that.database.transaction(groupitems => {
            for (const groupitem of groupitems) odBInsertGroupItem.run(groupitem);
        })
        var grpIteminserts = []

        let oResult = JSON.parse(result)
        if ((oResult) && (oResult.items)) {
            oResult.items.forEach(item => {
                that.logger.debug('Adding Group %s', item.name)
                grpinserts.push({
                    regaid: item.id,
                    name: item.name,
                    type: 'ID_' + type + 'S'
                })

                item.channels.forEach(channel => {
                    grpIteminserts.push({
                        groupid: item.id,
                        regaid: parseInt(channel)
                    })
                })
            })
            that.logger.info('Committing %s to filedb', type)
            insertGroup(grpinserts)
            insertGroupItem(grpIteminserts)
            that.logger.debug('Committing done')
        } else {
            that.logger.error("No Groupdata found")
        }
        if (callback) {
            callback()
        }
    })
}


function LocalStorage(server, appRoot) {
    let that = this
    this.log = require(appRoot + '/logger.js').logger('LocalStorage')
    this.appRoot = appRoot
    this.server = server
    this.configuration = this.server.configuration
    this.hm_layer = this.server.getBridge()
    this.dbPath = path.join(this.configuration.storagePath(), 'devices.db')
    if (!fs.existsSync(this.dbPath)) {
        this.log.error("Missing logic databases. Will trigger a rebuild from ccu in about 30 seconds")
        setTimeout(function() {
            that.log.info("Autobuild logic database")
            that.refreshDatabaseFromCCU()
        }, 30000)
    }
}

util.inherits(LocalStorage, EventEmitter)

LocalStorage.prototype.init = function() {
    let that = this
    if (this.deviceDB) {
        this.deviceDB.close()
    }

    if (fs.existsSync(this.dbPath)) {
        this.log.info('Create inMemory database')
        this.deviceDB = require('better-sqlite3')('memory', {
            memory: true
        });
        this.log.info('Attaching fileDB %s', this.dbPath)
        this.deviceDB.prepare('ATTACH "' + this.dbPath + '" AS sourceDB;').run()

        this.log.info('Copying data')
        let tables = ['channels', 'datapoints', 'devices', 'groupitems', 'groups']
        tables.forEach(tablename => {
            that.deviceDB.prepare('CREATE TABLE ' + tablename + ' AS SELECT * FROM sourceDB.' + tablename).run()
        })
        this.log.info('Detaching from filedb')
        this.deviceDB.prepare('DETACH DATABASE sourceDB;').run()
        this.emit('local_storage_init_done')
    }
}

LocalStorage.prototype.refreshDatabaseFromCCU = function() {
    let that = this
    if (this.deviceDB) {
        this.deviceDB.close()
    }
    let dbtmp = path.join(this.configuration.storagePath(), 'devices.db')
    let rega = require(this.appRoot + '/HomematicReqaRequest.js')
    this.log.info('Rebuild a new SQLite Database at %s', dbtmp)
    if (fs.existsSync(dbtmp)) {
        fs.unlinkSync(dbtmp)
    }

    let db = require('better-sqlite3')(dbtmp)

    let dimp = new DeviceImporter(db, rega, this.log)
    dimp.run(that.hm_layer, function() {
        let rimp = new RoomImporter(db, rega, that.log)
        rimp.run(that.hm_layer, "ROOM", function() {
            rimp.run(that.hm_layer, "FUNCTION", function() {
                db.close()
                    // Refresh
                that.log.info("Rebuild done. Reinit active database")
                that.init()
            })
        })
    })
}

LocalStorage.prototype.channelName = function(datapoint) {
    if (this.deviceDB) {
        let that = this
        let cadra = datapoint.split('.')
        let adr = (cadra.length > 2) ? cadra[1] : undefined

        if (adr) {
            let sql = 'select name from channels where address = ?'
            let row = this.deviceDB.prepare(sql).get(adr);
            if (row) {
                return row.name
            }
        }
    }
    return undefined
}


LocalStorage.prototype.getAddress = function(arg1, arg2, arg3) {
    if (this.deviceDB) {
        if (arg3 === undefined) {
            // Fetch the channel
            let row = this.deviceDB.prepare('select devices.interface , channels.address from devices inner join channels on devices.regaid = channels.device where channels.name like ?').get(arg1)
            if (row) {
                let adr = row.interface + '.' + row.address + '.' + arg2
                return adr
            }
        } else {
            let row = this.deviceDB.prepare('select interface,address from devices where devices.name like ?').get(arg1)
            if (row) {
                let adr = row.interface + '.' + row.address + ':' + arg2 + '.' + arg3
                return adr
            }
        }
        this.log.error("No Address found for %s - %s - %s", arg1, arg2, arg3)
    }
    return undefined
}

LocalStorage.prototype.isDouble = function(datapoint) {
    if (this.deviceDB) {
        let dps = datapoint.toUpperCase()
        let row = this.deviceDB.prepare('Select vtype,vstype from datapoints Where address like ?').get(dps)
        if (row) {
            return ((row.vtype === 6) && (row.vstype === 0))
        } else {
            this.log.warn('Nothing found for %s', dps)
        }
    }
    this.log.warn('Unable to check datapoint %s', datapoint)
    return undefined
}


LocalStorage.prototype.getDpsInGroup = function(id_group, section, dpname) {
    if (this.deviceDB) {
        let sql = 'SELECT datapoints.address FROM datapoints INNER JOIN groups ON groups.regaid = groupitems.groupid INNER JOIN groupitems ON channels.regaid = groupitems.regaid INNER JOIN channels ON datapoints.channel = channels.regaid  WHERE (groups.type like ?)  and (groups.name like ?) and (datapoints.name like ?)'
        let row = this.deviceDB.prepare(sql).all(id_group, section, dpname);
        if (row) {
            var result = []
            row.forEach(item => {
                result.push(item.address)
            })
            return result
        }
    }
    return undefined
}

module.exports = {
    LocalStorage: LocalStorage
}