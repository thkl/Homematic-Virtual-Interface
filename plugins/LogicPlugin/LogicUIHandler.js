const path = require('path')
const url = require('url')
const uuidv4 = require('uuid/v4')

function LogicUIHandler(logicModule) {
    this.logicModule = logicModule
    this.plugin = logicModule.plugin
}

LogicUIHandler.prototype.buildScriptList = function() {
    var that = this.logicModule
    var jobs = []
    var scripts = []
    Object.keys(this.scheduler.scheduledJobs).forEach(function(job) {
        jobs.push(job)
    })

    var sorted = Object.keys(that.scripts).sort(function(a, b) {
        a = that.scripts[a].name || path.basename(a)
        b = that.scripts[b].name || path.basename(b)
        if (a < b) return -1
        if (a > b) return 1
        return 0
    })

    that.log.debug(sorted)

    sorted.forEach(function(key) {
        var script_object = that.scripts[key]
        var data = {
            'script.filename': path.basename(script_object.file),
            'script.desc': script_object.description || '',
            'script.name': script_object.name || path.basename(script_object.file),
            'script.tags': script_object.tags || []
        }
        scripts.push(data)
    })

    return {
        'jobs': jobs,
        'scripts': scripts
    }
}

LogicUIHandler.prototype.run = function(dispatched_request, appRoot) {
    var requesturl = dispatched_request.request.url
    var queryObject = url.parse(requesturl, true).query
    var htmlfile = 'index.html'
    var editorData = {
        'error': ''
    }
    var that = this.logicModule
    let hookurl = '/' + that.name + '/Hook/'

    if (requesturl.toLowerCase().indexOf(hookurl.toLocaleLowerCase()) === 0) {
        that.handleWebHook(dispatched_request)
    } else {

        if (queryObject['do'] !== undefined) {
            switch (queryObject['do']) {

                case 'reload':
                    that.reInitScripts()
                    break

                case 'rebuilddb':
                    if (that.localStorage) {
                        that.localStorage.refreshDatabaseFromCCU()
                    }
                    break

                case 'trigger':
                    that.triggerScript(queryObject['script'])
                    break

                case 'list':
                    let list = this.buildScriptList()
                    dispatched_request.dispatchData(JSON.stringify(list), 'application/json')
                    break

                case 'showlog':
                    htmlfile = 'log.html'
                    var LoggerQuery = require(path.join(appRoot, 'logger.js')).LoggerQuery
                    new LoggerQuery('LogicLogger').query(function(err, result) {
                        var str = ''
                        result.some(function(msg) {
                            str = str + msg.time + '  [' + msg.level + '] - ' + msg.msg + '\n'
                        })

                        editorData['content'] = str
                        dispatched_request.dispatchFile(that.plugin.pluginPath, htmlfile, {
                            'editor': editorData
                        })
                    })
                    return

                case 'edit':
                    htmlfile = 'editor.html'
                    var scriptname = queryObject['file']
                    var script = that.getScript(scriptname)
                    editorData['file'] = scriptname
                    editorData['content'] = script
                    editorData['new'] = 'false'

                    break

                case 'new':
                    htmlfile = 'editor.html'
                    scriptname = queryObject['file']
                    editorData['file'] = uuidv4() + '.js'
                    editorData['content'] = '/*****\n* some notes about the script\n*\n*\n****/\nsetName("__Name__")\nsetDescription("___DESCRIPTION___")\naddTag("")\n\n'
                    editorData['new'] = 'true'

                    break

                case 'delete':
                    scriptname = queryObject['file']
                    that.deleteScript(scriptname)
                    that.reInitScripts()
                    htmlfile = 'reinit.html'

                    break
            }
        }

        if (dispatched_request.post !== undefined) {
            var content = dispatched_request.post['editor.content']
            var fileName = dispatched_request.post['script.filename']
            var isNew = dispatched_request.post['editor.new']
            switch (dispatched_request.post['do']) {
                case 'script.save':
                    Error.stackTraceLimit = 1
                    var result = that.validateScript(content)
                    Error.stackTraceLimit = 10
                    if (result === true) {
                        var l_path = that.configuration.storagePath() + '/scripts/'
                        fileName = fileName.replace('..', '')
                        if ((isNew === 'true') && (that.existsScript(l_path + fileName))) {
                            htmlfile = 'editor.html'
                            editorData['error'] = 'File ' + fileName + ' exists.'
                            editorData['content'] = content
                            editorData['file'] = fileName
                            editorData['new'] = isNew
                        } else {
                            that.saveScript(content, l_path + fileName)
                            htmlfile = 'reinit.html'
                        }
                    } else {
                        htmlfile = 'editor.html'
                        editorData['error'] = result
                        editorData['content'] = content
                        editorData['file'] = fileName
                        editorData['new'] = isNew
                    }

                    break

                case 'script.validate':
                    Error.stackTraceLimit = 1
                    result = that.validateScript(content)
                    Error.stackTraceLimit = 10
                    if (result === true) {
                        editorData['error'] = 'Validation : ok'
                    } else {
                        editorData['error'] = 'Validation : ' + result
                    }

                    htmlfile = 'editor.html'
                    editorData['content'] = content
                    editorData['file'] = fileName
                    editorData['new'] = isNew

                    break
            }
        }

        var strScripts = ''
        var strSchedulers = ''

        var itemtemplate = dispatched_request.getTemplate(that.plugin.pluginPath, 'list_item_tmp.html', null)
        var scripttemplate = dispatched_request.getTemplate(that.plugin.pluginPath, 'list_script_tmp.html', null)

        let list = this.buildScriptList()

        list.jobs.forEach(job => {
            strSchedulers = strSchedulers + dispatched_request.fillTemplate(itemtemplate, {
                'item': job
            })
        })

        list.scripts.forEach(script => {
            strScripts = strScripts + dispatched_request.fillTemplate(scripttemplate, script)
        })

        dispatched_request.dispatchFile(that.plugin.pluginPath, htmlfile, {
            'scripts': strScripts,
            'schedules': strSchedulers,
            'editor': editorData
        })

    }
}

module.exports = {
    LogicUIHandler: LogicUIHandler
}