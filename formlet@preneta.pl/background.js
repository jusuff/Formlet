/**
 * Cache for extension preferences
 * @type {FormletPrefs}
 */
let prefsCache;

/**
 * Setups context menu according to Formlet preferences
 *
 * @param {FormletPrefs} prefs Formlet preferences object
 */
function setupMenu(prefs) {
    browser.contextMenus.removeAll().then(() => {
        if (prefs.showDialog) {
            browser.contextMenus.create({
                id: 'formlet',
                title: 'Formlet',
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-save',
                parentId: 'formlet',
                title: browser.i18n.getMessage('contextMenuSaveForm'),
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-separator',
                parentId: 'formlet',
                type: 'separator',
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-saveBlank',
                parentId: 'formlet',
                title: browser.i18n.getMessage('saveBlankTitle'),
                type: 'checkbox',
                checked: prefs.saveBlank,
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-saveHidden',
                parentId: 'formlet',
                title: browser.i18n.getMessage('saveHiddenTitle'),
                type: 'checkbox',
                checked: prefs.saveHidden,
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-savePasswords',
                parentId: 'formlet',
                title: browser.i18n.getMessage('savePasswordsTitle'),
                type: 'checkbox',
                checked: prefs.savePasswords,
                contexts: ['all']
            });
            browser.contextMenus.create({
                id: 'formlet-saveFormId',
                parentId: 'formlet',
                title: browser.i18n.getMessage('saveFormIdTitle'),
                type: 'checkbox',
                checked: prefs.saveFormId,
                contexts: ['all']
            });

        } else {
            browser.contextMenus.create({
                id: 'formlet',
                title: browser.i18n.getMessage('contextMenuLabel'),
                contexts: ['all']
            });
        }
    });
}

/**
 * Updates prefs cache and context menu on storage changes
 *
 * @param {browser.storage.StorageChange}   changes  Object with changed preferences
 * @param {string}                          area     Storage type
 */
function updatePrefs(changes, area) {
    for (let pref in changes) {
        prefsCache[pref] = changes[pref].newValue;
    }
    setupMenu(prefsCache);
}

/**
 * Handles context menu command.
 * Depending on clicked item - updates preferences or calls content script and saves form.
 *
 * @param {browser.contextMenus.OnClickData}    info
 * @param {browser.tabs.Tab}                    tab
 */
function menuCommand(info, tab) {

    if (info.menuItemId.includes('formlet')) {
        if (info.menuItemId === 'formlet' || info.menuItemId === 'formlet-save') {
            browser.tabs.sendMessage(tab.id, prefsCache).then(response => {
                let date = (new Date()).toLocaleString(),
                    title = prefsCache.titlePattern.replace('{TITLE}', response.title).replace('{DATE}', date);
                browser.bookmarks.create({
                    title: title,
                    url: response.code,
                    parentId: prefsCache.bookmarksFolder
                }).then(bookmark => {
                    browser.notifications.create({
                        'type': 'basic',
                        'iconUrl': browser.extension.getURL('icons/formlet-48.png'),
                        'title': browser.i18n.getMessage('notificationTitle'),
                        'message': browser.i18n.getMessage('notificationContent', title)
                    });
                })
            });
        } else {
            let command = info.menuItemId.split('-')[1];
            prefsCache[command] = info.checked;
            browser.storage.sync.set({[command]: info.checked});
        }

    }
}

/**
 * Receives messages from content script.
 * The message is sent when context menu event is triggered and indicates whether the menu was triggered
 * for the form or element inside the form.
 * Depending on this, it enables or disables the context menu item with the form save command.
 *
 * @param {Object}                          request
 * @param {browser.runtime.MessageSender}   sender      Object with details about the message sender
 * @param {function}                        callback
 */
function handleMessage(request, sender, callback) {
    let id = prefsCache.showDialog ? 'formlet-save' : 'formlet';
    browser.contextMenus.update(id, {
        enabled: request.formFound
    });
}

/**
 * Setups default params on extension installation or update.
 *
 * @param {Object}  details
 */
function setupDefaults(details) {
    /**
     * @typedef {{saveBlank: boolean, saveHidden: boolean, savePasswords: boolean, saveFormId: boolean, showDialog: boolean, titlePattern: string, bookmarksFolder: string}} FormletPrefs
     */
    let defaults = {
        saveBlank: false,
        saveHidden: false,
        savePasswords: false,
        saveFormId: true,
        showDialog: false,
        titlePattern: 'FormLet - {TITLE} - {DATE}',
        bookmarksFolder: 'unfiled_____', // @todo - how to query default folder id and save it in defaults
    };

    browser.storage.sync.get(defaults).then(result => browser.storage.sync.set(result));
}

/**
 * Initialisation routine.
 * Setups menu and observers.
 *
 * @param {FormletPrefs} prefs
 */
function init(prefs) {

    prefsCache = prefs;

    setupMenu(prefs);

    browser.storage.onChanged.addListener(updatePrefs);
    browser.contextMenus.onClicked.addListener(menuCommand);
    browser.runtime.onMessage.addListener(handleMessage);
}

/**
 * Get extension preferences from storage and init extension
 */
browser.storage.sync.get().then(init);
/**
 * Listen to installation event
 */
browser.runtime.onInstalled.addListener(setupDefaults);
