jest.mock('electron', () => ({ ipcMain: { on: jest.fn() }, app: {} }))
jest.mock('../utils', () => ({
    ipcHandle: jest.fn(), ipcCall: jest.fn(() => jest.fn()),
    ipcRegisterBroadcast: jest.fn(), ipcSendEvent: jest.fn(),
}))

const fs = require('fs')
const FileWatchFeature = require('./feature')

describe('FileWatchFeature', () => {
    let feature, onChange, sizes

    const flush = () => new Promise(done => setImmediate(done))
    const settle = async () => { for (let i = 0; i < 10; i++) await flush() }

    beforeEach(() => {
        feature = new FileWatchFeature()
        sizes = {}
        feature.createWatcher = jest.fn((_dir, cb) => { onChange = cb; return { close: jest.fn() } })
        feature.stat = jest.fn(file => sizes[file] === undefined ? undefined : { size: sizes[file] })
        feature.sleep = jest.fn(() => Promise.resolve())
        feature.notify = jest.fn()
        jest.spyOn(fs, 'existsSync').mockReturnValue(true)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('reports a new file with a watched extension once it is complete', async () => {
        const id = feature.watch('/dl', ['zwo'])
        sizes['/dl/FTP Builder.zwo'] = 1200

        onChange('rename', 'FTP Builder.zwo')
        await settle()

        expect(feature.notify).toHaveBeenCalledWith(id, expect.objectContaining({
            filename: '/dl/FTP Builder.zwo', name: 'FTP Builder', ext: 'zwo', dir: '/dl', size: 1200,
        }))
    })

    test('ignores other extensions and temporary download files', async () => {
        feature.watch('/dl', ['zwo'])
        sizes['/dl/a.pdf'] = 10
        sizes['/dl/b.zwo.crdownload'] = 10

        onChange('rename', 'a.pdf')
        onChange('rename', 'b.zwo.crdownload')
        await settle()

        expect(feature.notify).not.toHaveBeenCalled()
    })

    test('waits until the file size is stable', async () => {
        feature.watch('/dl', ['zwo'])
        const growing = [100, 500, 900, 900]
        feature.stat = jest.fn(() => ({ size: growing.shift() ?? 900 }))

        onChange('change', 'w.zwo')
        await settle()

        expect(feature.stat).toHaveBeenCalledTimes(4)
        expect(feature.notify).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ size: 900 }))
    })

    test('reports each file only once', async () => {
        feature.watch('/dl', ['zwo'])
        sizes['/dl/w.zwo'] = 300

        onChange('rename', 'w.zwo')
        onChange('change', 'w.zwo')
        await settle()
        onChange('change', 'w.zwo')
        await settle()

        expect(feature.notify).toHaveBeenCalledTimes(1)
    })

    test('does not report a file that disappears again', async () => {
        feature.watch('/dl', ['zwo'])

        onChange('rename', 'gone.zwo')
        await settle()

        expect(feature.notify).not.toHaveBeenCalled()
    })

    test('a missing folder can not be watched', () => {
        fs.existsSync.mockReturnValue(false)

        expect(feature.watch('/missing', ['zwo'])).toBeUndefined()
    })

    test('unwatch closes the watcher', () => {
        const id = feature.watch('/dl', ['zwo'])

        expect(feature.unwatch(id)).toBe(true)
        expect(feature.unwatch(id)).toBe(false)
    })
})
