const NativeUISupport = require('./feature')
const { app } = require('electron')

describe('NativeUISupport.quitRequest', () => {

    let instance

    beforeEach(() => {
        instance = NativeUISupport.getInstance()
        app.incyclistApp = {
            getMainWindow: jest.fn(),
            quit: jest.fn()
        }
    })

    test('routes through the same app-event/closing handshake as the window close (X) button when a main window exists', () => {
        const mainWindow = { send: jest.fn() }
        app.incyclistApp.getMainWindow.mockReturnValue(mainWindow)

        instance.quitRequest()

        expect(mainWindow.send).toHaveBeenCalledWith('app-event', {component:'app', closing:true})
        expect(app.incyclistApp.quit).not.toHaveBeenCalled()
    })

    test('falls back to quitting directly when there is no main window', () => {
        app.incyclistApp.getMainWindow.mockReturnValue(undefined)

        instance.quitRequest()

        expect(app.incyclistApp.quit).toHaveBeenCalled()
    })

})

describe('NativeUISupport.confirmExit', () => {

    let instance

    beforeEach(() => {
        instance = NativeUISupport.getInstance()
        app.incyclistApp = {
            getMainWindow: jest.fn()
        }
    })

    test('calls confirmClose() on the main window', () => {
        const mainWindow = { confirmClose: jest.fn() }
        app.incyclistApp.getMainWindow.mockReturnValue(mainWindow)

        instance.confirmExit()

        expect(mainWindow.confirmClose).toHaveBeenCalled()
    })

    test('does not throw when there is no main window', () => {
        app.incyclistApp.getMainWindow.mockReturnValue(undefined)

        expect(() => instance.confirmExit()).not.toThrow()
    })

})

describe('NativeUISupport.toggleFullScreen', () => {

    const os = require('os')
    let instance
    let win

    const createWindow = (props={}) => ({
        isFullScreen: jest.fn().mockReturnValue(props.fullScreen??false),
        setFullScreen: jest.fn(),
        isSimpleFullScreen: jest.fn().mockReturnValue(props.simpleFullScreen??false),
        setSimpleFullScreen: jest.fn(),
    })

    beforeEach(() => {
        instance = NativeUISupport.getInstance()
        win = createWindow()
        app.incyclistApp = {
            getWindowManager: jest.fn().mockReturnValue({ getActiveWindow: jest.fn().mockReturnValue(win) })
        }
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('returns true when the active window was toggled', () => {
        jest.spyOn(os, 'platform').mockReturnValue('win32')

        expect(instance.toggleFullScreen()).toBe(true)
        expect(win.setFullScreen).toHaveBeenCalledWith(true)
    })

    test('returns false when there is no active window', () => {
        app.incyclistApp.getWindowManager().getActiveWindow.mockReturnValue(undefined)

        expect(instance.toggleFullScreen()).toBe(false)
    })

    test('returns false when toggling throws', () => {
        app.incyclistApp.getWindowManager.mockImplementation(() => { throw new Error('boom') })
        instance.setLogger({ logEvent: jest.fn() })

        expect(instance.toggleFullScreen()).toBe(false)
    })

    test('uses native fullscreen on Windows/Linux', () => {
        jest.spyOn(os, 'platform').mockReturnValue('linux')
        win = createWindow({fullScreen:true})

        instance.toggleWindowFullScreen(win)

        expect(win.setFullScreen).toHaveBeenCalledWith(false)
        expect(win.setSimpleFullScreen).not.toHaveBeenCalled()
    })

    test('uses simple fullscreen on macOS', () => {
        jest.spyOn(os, 'platform').mockReturnValue('darwin')

        instance.toggleWindowFullScreen(win)

        expect(win.setSimpleFullScreen).toHaveBeenCalledWith(true)
        expect(win.setFullScreen).not.toHaveBeenCalled()
    })

    test('leaves simple fullscreen on macOS', () => {
        jest.spyOn(os, 'platform').mockReturnValue('darwin')
        win = createWindow({simpleFullScreen:true})

        instance.toggleWindowFullScreen(win)

        expect(win.setSimpleFullScreen).toHaveBeenCalledWith(false)
    })

    test('leaves native fullscreen on macOS instead of stacking simple fullscreen on top', () => {
        jest.spyOn(os, 'platform').mockReturnValue('darwin')
        win = createWindow({fullScreen:true})

        instance.toggleWindowFullScreen(win)

        expect(win.setFullScreen).toHaveBeenCalledWith(false)
        expect(win.setSimpleFullScreen).not.toHaveBeenCalled()
    })

})

describe('NativeUISupport safe area (camera notch)', () => {

    const os = require('os')
    const { getNotchHeight } = require('./feature')
    let instance, win

    const display = (props) => ({ bounds:{x:0,y:0}, workArea:{x:0,y:0}, size:{width:1512,height:982}, internal:true, ...props })

    const createWindow = () => {
        let simple = false
        return {
            isFullScreen: jest.fn().mockReturnValue(false),
            setFullScreen: jest.fn(),
            isSimpleFullScreen: jest.fn(() => simple),
            setSimpleFullScreen: jest.fn(v => { simple = v }),
        }
    }

    beforeEach(() => {
        instance = NativeUISupport.getInstance()
        instance.safeAreaTop = 0
        win = createWindow()
        jest.spyOn(os, 'platform').mockReturnValue('darwin')
        jest.spyOn(instance, 'notifySafeArea').mockImplementation(() => {})
        jest.spyOn(instance, 'getNotchHeightForWindow').mockReturnValue(37)
    })

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('a notch display has a taller menu bar', () => {
        expect(getNotchHeight(display({ workArea:{x:0,y:37} }))).toBe(37)
    })

    test('a display without notch has a normal menu bar', () => {
        expect(getNotchHeight(display({ workArea:{x:0,y:25}, size:{width:1440,height:900} }))).toBe(0)
    })

    test('hidden menu bar: a built-in display with notch is recognised by its shape', () => {
        expect(getNotchHeight(display({}))).toBe(38)
    })

    test('hidden menu bar: external displays have no notch', () => {
        expect(getNotchHeight(display({ internal:false, size:{width:3024,height:1964} }))).toBe(0)
    })

    test('no display, no notch', () => {
        expect(getNotchHeight(undefined)).toBe(0)
    })

    test('keeps the notch free in simple fullscreen and tells the renderer', () => {
        instance.toggleWindowFullScreen(win)

        expect(instance.getSafeArea()).toEqual({ top:37 })
        expect(instance.notifySafeArea).toHaveBeenCalled()
    })

    test('no free area after leaving the fullscreen', () => {
        instance.toggleWindowFullScreen(win)
        instance.toggleWindowFullScreen(win)

        expect(instance.getSafeArea()).toEqual({ top:0 })
    })
})
