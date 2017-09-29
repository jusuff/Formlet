let prefsCache;

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
                enabled: false,
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
                enabled: false,
                contexts: ['all']
            });
        }
    });
}

function updatePrefs(changes, area) {
    for (let pref in changes) {
        prefsCache[pref] = changes[pref].newValue;
    }
    setupMenu(prefsCache);
}

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

function handleMessage(request, sender, sendResponse) {
    let id = prefsCache.showDialog ? 'formlet-save' : 'formlet';
    browser.contextMenus.update(id, {
        enabled: request.formFound
    });
}

function setupDefaults(details) {
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

function init(prefs) {

    prefsCache = prefs;

    setupMenu(prefs);

    browser.storage.onChanged.addListener(updatePrefs);
    browser.contextMenus.onClicked.addListener(menuCommand);
    browser.runtime.onMessage.addListener(handleMessage);
}

browser.storage.sync.get().then(init);
browser.runtime.onInstalled.addListener(setupDefaults);
