const LoadingWindow = require('./pages/loading');
const MainWindow = require('./pages/main');
const OAuthWindow = require('./pages/oauth');

// the splash screen is shown at least this long, so it can be seen and does not just flash up
const MIN_SPLASH_MS = 2000

class WindowManager {

    constructor(app) {
        this.mainWindow = undefined;
        this.loadingWindow = undefined;
        this.authWindows = {}
        this.app = app;

    }

    getMainWindow() {
        return this.mainWindow
    }

    setChecking() {
        if ( this.loadingWindow)
            this.loadingWindow.setChecking();
    }

    setLoading() {        
        if ( this.loadingWindow)
            this.loadingWindow.setLoading();
    }

    setUpdating() {         
        if ( this.loadingWindow)
            this.loadingWindow.setUpdating();
    }

    getActiveWindow() {
        if (this.mainWindow!==undefined)
            return this.mainWindow.win;
        if (this.loadingWindow!==undefined)
            return this.mainWindow.win;
    }

    showLoadingWindow() {
        if (!this.loadingWindow)
            this.loadingWindow = new LoadingWindow(this.app);
        this.loadingWindow.show();
        this.loadingShownAt = this.loadingShownAt ?? Date.now()

    }

    createMainWindow() {
        this.mainWindow = new MainWindow(this.app);        
    }

    hasMainWindow() {
        return this.mainWindow!==undefined && this.mainWindow!==null
    }

    showMainWindow() {
        const remaining = this.loadingShownAt ? MIN_SPLASH_MS - (Date.now() - this.loadingShownAt) : 0
        if (remaining > 0 && this.loadingWindow!==undefined) {
            clearTimeout(this.showMainTimeout)
            this.showMainTimeout = setTimeout(() => this.showMainWindow(), remaining)
            return
        }
        delete this.showMainTimeout

        if ( this.loadingWindow!==undefined && this.mainWindow!==undefined) {
            this.loadingWindow.hide();
            this.mainWindow.show()
        }
        this.closeAuthWindow()
    }

    sendMainWindowEvent(key,event) {
        if ( this.mainWindow!==undefined)
            this.mainWindow.send( key,event)
    }

    closeMainWindow() {
        let win = this.mainWindow!==undefined ? this.mainWindow.win : undefined;

        if ( win!==undefined && win.webContents!==undefined) {
            const storage =win.webContents.session;
            if ( storage!==undefined)
                storage.flushStorageData();

            const cookies = win.webContents.session.cookies;
            if ( cookies!==undefined)
                cookies.flushStore( function() {});
        }

    }

    createAuthWindow(provider) {
        let window = this.authWindows[provider]
        if (!window) {
            window = new OAuthWindow(this.app,provider);
            this.authWindows[provider] = window;
        }
    }
    
    showAuthWindow(provider) { 
        let window = this.authWindows[provider]
        if (window) 
            window.show()

    }


    closeAuthWindow(provider) {
        let window = this.authWindows[provider]
        if (window) 
            window.hide()

    }

    focusActive() {
        if (this.getActiveWindow()) {
            const win = this.getActiveWindow();
            if (win.isMinimized()) 
                win.restore()
            win.focus()
        }

    }


}

module.exports = WindowManager