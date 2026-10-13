const fs = require('fs')
const path = require('path')
const { ipcMain } = require('electron')
const { EventLogger } = require('gd-eventlog')
const { ipcHandle, ipcCall, ipcRegisterBroadcast, ipcSendEvent } = require('../utils')
const Feature = require('../base')

const EVENT = 'file-watch-event'
// a file is reported once its size did not change for this time (browsers write downloads in chunks)
const STABLE_MS = 800
const MAX_CHECKS = 40

/**
 * Watches folders for new files with given extensions, e.g. workouts downloaded into ~/Downloads.
 *
 * Only files that appear after the watch was started are reported, and only once they are
 * completely written. Temporary download files (.crdownload, .part, .download) are ignored -
 * the final file is reported after the browser renamed it.
 */
class FileWatchFeature extends Feature {
    static _instance

    static getInstance() {
        if (!FileWatchFeature._instance)
            FileWatchFeature._instance = new FileWatchFeature()
        return FileWatchFeature._instance
    }

    constructor() {
        super()
        this.logger = new EventLogger('FileWatch')
        this.watchers = {}
        this.cnt = 0
    }

    /**
     * Starts watching a folder
     *
     * @param {string} dir folder to watch
     * @param {Array<string>} extensions file extensions to report (without dot, case insensitive)
     * @returns {string|undefined} id of the watch, undefined if the folder can't be watched
     */
    watch(dir, extensions = []) {
        try {
            if (!dir || !fs.existsSync(dir))
                return undefined

            const id = `watch-${++this.cnt}`
            const exts = extensions.map(e => e.toLowerCase().replace(/^\./, ''))
            const pending = new Set()
            const reported = new Set()

            const watcher = this.createWatcher(dir, (_event, filename) => {
                if (!filename)
                    return
                const ext = path.extname(filename).toLowerCase().replace(/^\./, '')
                if (!exts.includes(ext))
                    return
                const full = path.join(dir, filename)
                if (pending.has(full) || reported.has(full))
                    return
                pending.add(full)
                this.waitUntilComplete(full).then(info => {
                    pending.delete(full)
                    if (!info)
                        return
                    reported.add(full)
                    this.logger.logEvent({ message: 'file detected', ext })
                    this.notify(id, { filename: full, dir, name: path.basename(filename, path.extname(filename)), base: filename, ext, size: info.size })
                })
            })

            this.watchers[id] = watcher
            this.logger.logEvent({ message: 'watch started', id, extensions: exts })
            return id
        }
        catch (err) {
            this.logger.logEvent({ message: 'error', fn: 'watch', error: err.message })
            return undefined
        }
    }

    /**
     * Stops a watch
     *
     * @param {string} id id returned by watch()
     */
    unwatch(id) {
        const watcher = this.watchers[id]
        if (!watcher)
            return false
        try { watcher.close() } catch { /* already closed */ }
        delete this.watchers[id]
        return true
    }

    // resolves with the file stats once the file exists and its size is stable, undefined if it disappears
    async waitUntilComplete(file) {
        let prevSize = -1
        for (let i = 0; i < MAX_CHECKS; i++) {
            const stat = this.stat(file)
            if (!stat)
                return undefined
            if (stat.size > 0 && stat.size === prevSize)
                return stat
            prevSize = stat.size
            await this.sleep(STABLE_MS)
        }
        return undefined
    }

    notify(id, file) {
        ipcSendEvent(EVENT, id, file)
    }

    // --- wrappers (mocked in unit tests)

    createWatcher(dir, onChange) {
        return fs.watch(dir, { persistent: false }, onChange)
    }

    stat(file) {
        try { return fs.statSync(file) }
        catch { return undefined }
    }

    sleep(ms) {
        return new Promise(done => setTimeout(done, ms))
    }

    // --- IPC wiring

    register() {
        ipcHandle('file-watch-watch', this.watch.bind(this), ipcMain)
        ipcHandle('file-watch-unwatch', this.unwatch.bind(this), ipcMain)
    }

    registerRenderer(spec, ipcRenderer) {
        spec.fileWatch = {}
        spec.fileWatch.watch = ipcCall('file-watch-watch', ipcRenderer)
        spec.fileWatch.unwatch = ipcCall('file-watch-unwatch', ipcRenderer)
        // renderer subscribes via spec.fileWatch.onMessage( (id,file) => ... )
        ipcRegisterBroadcast(spec.fileWatch, EVENT, ipcRenderer)

        spec.registerFeatures(['fileWatch'])
    }
}

module.exports = FileWatchFeature
