/**
 * Text input class.
 * It setups and updates text input value and cares about storing changes.
 */
class Input {
    /**
     * Setups input element.
     *
     * @param {string}          id      HTML Element Id
     * @param {string|boolean}  value   Initial element value
     */
    constructor(id, value) {
        this.id = id;
        this.element = document.getElementById(id);
        this.setValue(value);
        this.setup();
    }

    /**
     * Starts observer for changes in text input.
     */
    setup() {
        this.element.addEventListener('change', () => {
            browser.storage.sync.set({[this.id]: this.element.value});
        });
    }

    /**
     * Sets input value.
     *
     * @param {string} value
     */
    setValue(value) {
        this.element.value = value;
    }

    /**
     * Gets input value.
     */
    getValue() {
        return this.element.value;
    }
}

/**
 * Checkbox input class.
 *
 * @extends Input
 */
class Checkbox extends Input {
    /** @inheritdoc */
    setup() {
        this.element.addEventListener('click', () => {
            browser.storage.sync.set({[this.id]: this.element.checked});
        });
    }

    /**
     * Sets checkbox checked state.
     *
     * @param {boolean} value
     */
    setValue(value) {
        this.element.checked = value;
    }

    /** @inheritdoc */
    getValue() {
        return this.element.checked;
    }
}

/**
 * Bookmarks browser class.
 * Implements Input class for button element and adds bookmarks browser widget.
 *
 * @extends Input
 */
class Folder extends Input {
    /**
     * Initializes widget.
     */
    setup() {
        this.setupContainer();
        this.element.addEventListener('click', this.toggle.bind(this));
    }

    /**
     * Sets bookmark folder as button value and folder path as buttons text.
     *
     * @param {string} value
     */
    setValue(value) {
        Folder.getBookmarksFolderPath(value).then(path => {
            this.element.textContent = path;
            this.element.value = value;
        });
    }

    /**
     * Setups container for bookmark folder browser.
     */
    setupContainer() {
        this.container = document.createElement('div');
        this.container.className = 'bookmark-selector';
        this.container.style.display = 'none';
        this.element.parentNode.appendChild(this.container);
        this.container.addEventListener('click', this.itemOnClick.bind(this));
    };

    /**
     * Builds folder list for given tree level.
     *
     * @param {browser.bookmarks.BookmarkTreeNode}  tree        Bookmarks node for which list has to be build
     * @param {string}                              currentItem Id of currently selected bookmark
     *
     * @returns {Promise<HTMLUListElement>} List for given bookmarks tree level
     */
    buildList(tree, currentItem) {
        return new Promise((resolve) => {
            let oldList = this.container.querySelector('ul'),
                list = document.createElement('ul');

            list.className = 'bookmark-list';
            if (tree.parentId) {
                let headerBack = document.createElement('li'),
                    headerItem = document.createElement('li');
                headerBack.className = 'header';
                headerBack.dataset.id = tree.parentId;
                headerBack.textContent = browser.i18n.getMessage('bookmarksFolderBrowserBack');
                list.appendChild(headerBack);
                headerItem.className = 'folder';
                headerItem.dataset.id = tree.id;
                headerItem.textContent = browser.i18n.getMessage('bookmarksFolderBrowserSelectThis', tree.title);
                list.appendChild(headerItem);
            }
            tree.children.forEach(folder => {
                if (folder.title !== '' && !folder.url) {
                    let item = document.createElement('li'),
                        classes = ['folder'];
                    if (folder.children && folder.children.some(item => !item.url)) {
                        classes.push('children');
                    }
                    if (folder.id === currentItem) {
                        classes.push('selected');
                    }
                    item.className = classes.join(' ');
                    item.dataset.id = folder.id;
                    item.textContent = folder.title;
                    list.appendChild(item);
                }
            });

            if (oldList) {
                this.container.replaceChild(list, oldList);
            } else {
                this.container.appendChild(list);
            }
            resolve(list);
        });
    };

    /**
     * Handles clicks on folder list.
     * Expands items with children or saves selected folder.
     *
     * @param {Event}   event   Click event
     */
    itemOnClick(event) {
        let element = event.target,
            classList = Array.from(element.classList),
            id = element.dataset.id;
        if (classList.includes('children') || classList.includes('header')) {
            browser.bookmarks.getSubTree(id).then(result => this.buildList(result[0], id));
        } else if (classList.includes('folder')) {
            this.save(id);
            this.hide();
        }
    };

    /**
     * Checks whether the widget is visible.
     *
     * @returns {boolean}
     */
    isVisible() {
        return this.container.style.display === 'block';
    };

    /**
     * Toggles folder browser widget.
     *
     * @param {Event}   [event] Click event
     */
    toggle(event) {
        if (event !== undefined && event.preventDefault !== undefined) {
            event.preventDefault();
        }
        if (this.isVisible()) {
            this.hide();
        } else {
            this.show();
        }
    };

    /**
     * Gets folder tree and displays folder browser widget.
     */
    show() {
        this.hideonBlurBound = this.hideOnBlur.bind(this);
        browser.bookmarks.get(this.element.value).then(item => {
            browser.bookmarks.getSubTree(item[0].parentId).then(items => {
                this.buildList(items[0], this.element.value).then(list => {
                    this.container.style.display = 'block';
                    document.body.addEventListener('click', this.hideonBlurBound);
                })
            });
        });
    };

    /**
     * Hides folder browser.
     */
    hide() {
        this.container.style.display = 'none';
        document.body.removeEventListener('click', this.hideonBlurBound);
    };

    /**
     * Observes document outside folder browser and hides browser is user click outside it.
     *
     * @param {Event} event Click event
     */
    hideOnBlur(event) {
        let parents = [],
            element = event.target;
        parents.push(element);
        while (element.parentNode) {
            parents.unshift(element.parentNode);
            element = element.parentNode;
        }
        if (!parents.includes(this.container)) {
            this.hide();
        }
    }

    /**
     * Stores folder id.
     *
     * @param {string} id Bookmarks folder id
     */
    save(id) {
        browser.storage.sync.set({[this.element.id]: id}).then(() => {
            this.setValue(id);
        });
    }

    /**
     * Builds folder path using bookmark and its parents names.
     *
     * @param {string} id Bookmarks folder id
     *
     * @returns {Promise.<string>}
     */
    static async getBookmarksFolderPath(id) {
        let [item] = await browser.bookmarks.get(id),
            path = [item.title];

        while (item.parentId) {
            [item] = await browser.bookmarks.get(item.parentId);
            path.unshift(item.title);
        }
        return path.join('/');
    }
}

/**
 * Preferences form fields storage.
 *
 * @type {Object}
 */
const fields = {};

/**
 * Translates i18n messages in html options page.
 *
 * @author erosman
 * @see {@link https://github.com/erosman/HTML-Internationalization/blob/master/internationalization.js}
 */
function translate() {
    for (let node of document.querySelectorAll('[data-i18n]')) {
        let [text, attr] = node.dataset.i18n.split('|');
        text = chrome.i18n.getMessage(text);
        attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
    }
}

/**
 * Setups preferences page.
 *
 * @param {FormletPrefs} prefs Formlet preferences object
 */
function setupPrefsUI(prefs) {
    fields.saveBlank = new Checkbox('saveBlank', prefs.saveBlank);
    fields.saveHidden = new Checkbox('saveHidden', prefs.saveHidden);
    fields.savePasswords = new Checkbox('savePasswords', prefs.savePasswords);
    fields.saveFormId = new Checkbox('saveFormId', prefs.saveFormId);
    fields.showDialog = new Checkbox('showDialog', prefs.showDialog);
    fields.titlePattern = new Input('titlePattern', prefs.titlePattern);
    fields.bookmarksFolder = new Folder('bookmarksFolder', prefs.bookmarksFolder);

    translate();

    browser.storage.onChanged.addListener(updatePrefsUI);
}

/**
 * Updates preferences page on storage change.
 *
 * @param {browser.storage.StorageChange}   changes  Object with changed preferences
 * @param {string}                          area     Storage type
 */
function updatePrefsUI(changes, area) {
    for (let change in changes) {
        if (fields[change].value !== changes[change].newValue) {
            fields[change].setValue(changes[change].newValue);
        }
    }
}

/**
 *  Get extension preferences from storage and setup preferences page.
 */
browser.storage.sync.get().then(setupPrefsUI);

