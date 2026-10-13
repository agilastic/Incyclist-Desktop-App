jest.mock('./pages/loading', () => jest.fn().mockImplementation(() => ({ show: jest.fn(), hide: jest.fn() })))
jest.mock('./pages/main', () => jest.fn().mockImplementation(() => ({ show: jest.fn() })))
jest.mock('./pages/oauth', () => jest.fn())

const WindowManager = require('./manager')

describe('WindowManager splash screen', () => {
    let manager

    beforeEach(() => {
        jest.useFakeTimers()
        manager = new WindowManager({})
        manager.closeAuthWindow = jest.fn()
        manager.showLoadingWindow()
        manager.createMainWindow()
    })

    afterEach(() => {
        jest.useRealTimers()
    })

    test('the splash screen stays at least 2 seconds', () => {
        jest.advanceTimersByTime(500)
        manager.showMainWindow()

        expect(manager.mainWindow.show).not.toHaveBeenCalled()
        expect(manager.loadingWindow.hide).not.toHaveBeenCalled()

        jest.advanceTimersByTime(1500)

        expect(manager.loadingWindow.hide).toHaveBeenCalled()
        expect(manager.mainWindow.show).toHaveBeenCalled()
    })

    test('the main window is shown right away when the app needed longer than 2 seconds', () => {
        jest.advanceTimersByTime(3000)
        manager.showMainWindow()

        expect(manager.mainWindow.show).toHaveBeenCalled()
    })
})
