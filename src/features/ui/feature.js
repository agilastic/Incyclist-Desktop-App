const {shell,ipcMain,app,screen} = require('electron')
const {defineLogEventMethod, checkDir, getAppDirectory} = require ('../../utils');
const {ipcCall,   ipcHandle, ipcCallNoResponse, ipcHandleNoResponse,ipcRegisterBroadcast, ipcSendEvent} = require ('../utils')
const path = require('path')
const {promises} = require('fs')
const fs = promises
const os = require('os')
const Feature = require('../base');

const SAFE_AREA_EVENT = 'ui-safe-area'
// notch displays have a taller menu bar (37-38pt) than displays without (24-25pt)
const MIN_NOTCH_MENU_BAR = 30
const DEFAULT_NOTCH_HEIGHT = 38
// built-in MacBook displays with a notch are slightly taller than 16:10 (e.g. 1512x982 = 1.54)
const MAX_NOTCH_ASPECT = 1.57

/**
 * Height of the camera notch of a display (in DIP), 0 if it has none
 *
 * @param {Electron.Display} display
 */
const getNotchHeight = (display) => {
  if (!display)
    return 0
  const menuBar = (display.workArea?.y ?? 0) - (display.bounds?.y ?? 0)
  if (menuBar > MIN_NOTCH_MENU_BAR)
    return menuBar
  // menu bar hidden (e.g. "automatically hide the menu bar" or simple fullscreen): use the display shape
  const {width,height} = display.size ?? {}
  if (display.internal && width && height && width/height < MAX_NOTCH_ASPECT)
    return DEFAULT_NOTCH_HEIGHT
  return 0
}

 
class NativeUISupport extends Feature {

  static _instance;

  static getInstance(props = {}) {
    if (!NativeUISupport._instance)
      NativeUISupport._instance = new NativeUISupport(props)
    return NativeUISupport._instance
  }

  constructor(props = {}) {
    super()
    const {logger}  = props;
    this.logger = defineLogEventMethod(props.logger || console);
    this.shell = shell;
  } 

  setLogger(logger) {
    this.logger = logger
  }

  disableScreensaver() {
    app.incyclistApp.disableScreensaver();
    return true;
  }
  enableScreensaver() {
    app.incyclistApp.enableScreensaver();
    return true;
  }

  toggleFullScreen(){
    try {
      const win = app.incyclistApp.getWindowManager().getActiveWindow()
      if (!win)
        return false

      this.toggleWindowFullScreen(win)
      return true
    }
    catch(err) {
      this.logger.logEvent( {message:'error',fn:'on(ui-toggleFullScreen)',error:err.message||err, stack:err.stack})
      return false;
    }
  }

  // shared by the IPC call and the keyboard shortcut, so both use the same fullscreen mode
  toggleWindowFullScreen(win) {
    if (os.platform() === 'darwin') {
      // macOS: use simple (pre-Lion) fullscreen; leave native fullscreen first if it was entered via the green button
      if (win.isFullScreen()) {
        win.setFullScreen(false)
        return
      }
      // measure the notch before the menu bar gets hidden by the simple fullscreen
      const notch = this.getNotchHeightForWindow(win)
      win.setSimpleFullScreen(!win.isSimpleFullScreen());
      this.safeAreaTop = win.isSimpleFullScreen() ? notch : 0
      this.notifySafeArea()
    }
    else  {
      win.setFullScreen(!win.isFullScreen());
    }
  }

  getNotchHeightForWindow(win) {
    try {
      return getNotchHeight( screen.getDisplayMatching(win.getBounds()) )
    }
    catch {
      return 0
    }
  }

  /**
   * Area at the top of the screen that must be kept free (camera notch in simple fullscreen on MacBooks)
   *
   * @returns {{top:number}} height in DIP (= CSS px)
   */
  getSafeArea() {
    return { top: this.safeAreaTop ?? 0 }
  }

  notifySafeArea() {
    try {
      ipcSendEvent(SAFE_AREA_EVENT, this.getSafeArea())
    }
    catch(err) {
      this.logger.logEvent( {message:'error',fn:'notifySafeArea',error:err.message})
    }
  }

  // Open an URL in a Browser
  openExternal(url) {
    try {
        shell.openExternal(url)
    }
    catch ( err) {
        this.logger.logEvent( {message:'openUrl error',error:err.message})
    }
  }

  // Open an URL in a new window within the app
  async openWindow(url) {

      // TODO    

  }

  confirmExit() {
    // confirmClose() closes the window normally (not destroy()), so the renderer's
    // beforeunload still fires and releases native device handles before quitting.
    let mainWindow = app.incyclistApp.getMainWindow();
    mainWindow?.confirmClose()

  }

  showItemInFolder(filename) {
    try {
        shell.showItemInFolder(filename)
    }
    catch ( err) {
        this.logger.logEvent( {message:'showItemInFolder error',error:err.message})
    }
  }
 
  async takeScreenshot(props) {
    const JPEG_QUALITY_DEFAULT = 70; 
    const {fileName = 'screenshot'} = props
        
    let win = app.incyclistApp.getWindowManager().getActiveWindow();
    let img = await win.capturePage();            
    let data = img.toJPEG(JPEG_QUALITY_DEFAULT)
    const appDir = getAppDirectory()
    
    const screenShotDir = path.join(appDir,'./screenshots')
    checkDir(screenShotDir);
    const fullPath = path.join( screenShotDir,`./${fileName}` )
    try {
        await fs.writeFile(fullPath, data)
    }
    catch(err) {
      this.logger.logEvent( {message:'error',fn:'takeScreenshot()',error:err.message||err, stack:errstack})
    }

    return fullPath


  }

  quitRequest() {
    // Route through the same 'app-event'/closing:true handshake used by the window's
    // close (X) button, instead of calling app.incyclistApp.quit() directly. That
    // shortcut skipped the renderer entirely - onAppExit() (MQTT session-end message,
    // device teardown) never ran, and the "Disconnecting..." UI never showed.
    const mainWindow = app.incyclistApp.getMainWindow();
    if (mainWindow) {
      mainWindow.send('app-event', {component:'app', closing:true});
    } else {
      app.incyclistApp.quit();
    }
  }

  sendBroadcast(event) {
    app.incyclistApp.sendBroadcast(event)
  }

  register(props) {


    ipcHandle('ui-disableScreensaver',this.disableScreensaver.bind(this),ipcMain)
    ipcHandle('ui-enableScreensaver',this.enableScreensaver.bind(this),ipcMain)
    ipcHandle('ui-toggleFullScreen',this.toggleFullScreen.bind(this),ipcMain)
    ipcHandle('ui-quit',this.quitRequest.bind(this),ipcMain)
    ipcHandle('ui-take-screenshot',this.takeScreenshot.bind(this),ipcMain)
    ipcHandle('ui-open-window',this.openWindow.bind(this),ipcMain)
    ipcHandle('ui-confirm-exit',this.confirmExit.bind(this),ipcMain)
    ipcHandle('ui-get-safe-area',this.getSafeArea.bind(this),ipcMain)
    ipcHandleNoResponse('ipc-sendBroadcast', this.sendBroadcast.bind(this),ipcMain)


  }

  registerRenderer( spec, ipcRenderer) {

    spec.showItemInFolder = (fileName) => this.showItemInFolder(fileName);
    spec.openPath = (path) => shell.openPath(path);
    spec.openExternal = (url) => this.openExternal(url);
    spec.beep = shell.beep;
    spec.shell = shell;


    spec.ui={}
    spec.ui.disableScreensaver   = ipcCall('ui-disableScreensaver',ipcRenderer)        
    spec.ui.enableScreensaver    = ipcCall('ui-enableScreensaver',ipcRenderer)        
    spec.ui.toggleFullScreen     = ipcCall('ui-toggleFullScreen',ipcRenderer)
    spec.ui.quit                 = ipcCall('ui-quit',ipcRenderer)
    spec.ui.takeScreenshot       = ipcCall('ui-take-screenshot',ipcRenderer)
    spec.ui.openWindow           = ipcCall('ui-open-window',ipcRenderer)
    
    spec.ui.confirmExit         = ipcCall('ui-confirm-exit',ipcRenderer)
    spec.ui.getSafeArea         = ipcCall('ui-get-safe-area',ipcRenderer)
    // renderer subscribes via spec.ui.safeArea.onMessage( ({top}) => ... )
    spec.ui.safeArea = {}
    ipcRegisterBroadcast(spec.ui.safeArea,SAFE_AREA_EVENT,ipcRenderer)

    spec.ipc={}
    spec.ipc.sendBroadcast       = ipcCallNoResponse('ipc-sendBroadcast',ipcRenderer)
    ipcRegisterBroadcast(spec.ipc,'app-event',ipcRenderer)

    spec.registerFeatures( [
        'shell.showItemInFolder', 'shell.openPath', 'shell.openExternal', 'shell.beep', 
        'ui.screensaver','ui.toggleFullSccreen', 'ui.toggleFullScreen', 'ui.quit', 'ui.screenshot','ui.confirmExit',
        'ipc.broadcast', 'ui.safeArea'
    ] )
  }

}

module.exports = NativeUISupport
module.exports.getNotchHeight = getNotchHeight