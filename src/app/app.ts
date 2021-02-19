import {
    ElectronWindow,
    handleExternalLink,
    promptYesNoSync,
    IPAD_USER_AGENT
} from '../common';
import {
    app,
    Cookie,
    ipcMain,
    session,
    MenuItem,
    NewWindowWebContentsEvent,
    HandlerDetails
} from 'electron';
import { PopoutHandler } from './popoutHandler/popoutHandler';
import { ThemeHandler } from './themeHandler/themeHandler';
import { DiscordHandler } from './discordHandler';
import { SettingHandler } from './settingHandler';
import contextMenu from 'electron-context-menu';
import { appMenuSetup } from './menu/appMenuSetup';
import { EventEmitter } from 'events';

class App extends EventEmitter {
    public readonly mainWindow: ElectronWindow;
    public readonly themeHandler: ThemeHandler;
    public readonly popoutHandler: PopoutHandler;
    public readonly discordHandler: DiscordHandler;
    protected windowArray: ElectronWindow[];
    private readonly settingsHandler: SettingHandler;
    private isOffline: boolean;

    constructor() {
        super();
        this.mainWindow = new ElectronWindow({
            height: 900,
            width: 1600
        });
        this.settingsHandler = new SettingHandler();
        this.windowArray = [];
        this.discordHandler = new DiscordHandler(this.mainWindow);
        this.mainWindow.setBackgroundColor('#393c42');
        this.themeHandler = new ThemeHandler(
            this.settingsHandler,
            this.mainWindow
        );
        this.popoutHandler = new PopoutHandler();
        this.addWindow(this.mainWindow);
        if (!this.settingsHandler.has('enable-ace')) {
            this.settingsHandler.set('enable-ace', false);
        } // Init settings for ace editor
        app.applicationMenu = appMenuSetup(
            this,
            this.themeHandler,
            this.settingsHandler,
            this.popoutHandler
        );
        this.isOffline = false;

        // Handle The Login
        this.mainWindow.webContents.on('new-window', (event, url) => {
            event.preventDefault();
            if (
                url == 'https://repl.it/auth/google/get?close=1' ||
                url == 'https://repl.it/auth/github/get?close=1'
            ) {
                this.handleOAuth(event, url);
            } else {
                const win = new ElectronWindow({
                    height: 900,
                    width: 1600
                });
                win.loadURL(url, {
                    userAgent: 'chrome'
                });
                event.newGuest = win;
                this.addWindow(win);
            }
        });
    }
    handleNewWindow(details: HandlerDetails) {
        // TODO: use this instead of new-window event
    }

    handleOAuth(event: NewWindowWebContentsEvent, url: string) {
        this.clearCookies(true);
        const authWin = new ElectronWindow(
            {
                height: 900,
                width: 1600
            },
            'auth.js'
        );
        authWin.loadURL(url, {
            userAgent: 'chrome'
        });

        // Handle The Login Process
        ipcMain.once('authDone', () =>
            this.mainWindow.loadURL('https://repl.it/~')
        );
        event.newGuest = authWin;
    }

    toggleAce(menu?: MenuItem) {
        let userAgent: string;
        if (menu) {
            if (menu.checked == true) {
                this.settingsHandler.set('enable-ace', true);
                userAgent = IPAD_USER_AGENT;
            } else {
                this.settingsHandler.set('enable-ace', false);
                userAgent = app.userAgentFallback;
            }
        } else {
            userAgent = IPAD_USER_AGENT;
        }
        this.windowArray.forEach((window) => {
            window.webContents.userAgent = userAgent;
            window.reload();
        });
    }

    async clearCookies(oauthOnly: boolean) {
        if (!oauthOnly) {
            if (
                !promptYesNoSync(
                    'Are you sure you want to clear all cookies?',
                    'Confirm'
                )
            ) {
                return;
            }
        }
        const allCookies: Array<Cookie> = await session.defaultSession.cookies.get(
            {}
        );
        const cookiesToRemove: Array<Cookie> = [];
        for (let x = 0; x < allCookies.length; x++) {
            const cookie: Cookie = allCookies[x];
            if (oauthOnly) {
                if (!cookie.domain.includes('repl.it')) {
                    // exclude repl.it cookies
                    cookiesToRemove.push(cookie);
                }
            } else {
                cookiesToRemove.push(cookie);
            }
        }
        for (let x = 0; x < cookiesToRemove.length; x++) {
            const cookie: Cookie = cookiesToRemove[x];
            await session.defaultSession.cookies.remove(
                `https://${cookie.domain.charAt(0) === '.' ? 'www' : ''}${
                    cookie.domain
                }${cookie.path}`,
                cookie.name
            );
            session.defaultSession.flushStorageData();
        }
        if (!oauthOnly) {
            for (let x = 0; x < this.windowArray.length; x++) {
                this.windowArray[x].reload();
            }
        }
    }

    addWindow(window: ElectronWindow) {
        contextMenu({ window: window });
        this.windowArray.push(window);
        window.webContents.on('will-navigate', (e, url) => {
            handleExternalLink(e, window, url);
            if (this.settingsHandler.get('enable-ace')) {
                this.toggleAce();
            }
        });

        this.themeHandler.addTheme(window);
        window.webContents.on('did-finish-load', () => {
            this.themeHandler.addTheme(window);
        });
    }
}

export { App };
