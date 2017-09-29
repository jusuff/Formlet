class Input {
    constructor(id, value) {
        this.id = id;
        this.element = document.getElementById(id);
        this.setValue(value);
        this.setup();
    }

    setup() {
        this.element.addEventListener('change', () => {
            browser.storage.sync.set({[this.id]: this.element.value});
        });
    }

    setValue(value) {
        this.element.value = value;
    }

    getValue() {
        return this.element.value;
    }
}

class Checkbox extends Input {
    setup() {
        this.element.addEventListener('click', () => {
            browser.storage.sync.set({[this.id]: this.element.checked});
        });
    }

    setValue(value) {
        this.element.checked = value;
    }

    getValue() {
        return this.element.checked;
    }
}

class Folder extends Input {
    setup() {
        this.setupContainer();
        this.element.addEventListener('click', this.toggle.bind(this));
    }

    setValue(value) {
        Folder.getBookmarksFolderPath(value).then(path => {
            this.element.innerHTML = path;
            this.element.value = value;
        });
    }

    setupContainer() {
        this.container = document.createElement('div');
        this.container.className = 'bookmark-selector';
        this.container.style.display = 'none';
        this.element.parentNode.appendChild(this.container);
        this.container.addEventListener('click', this.itemOnClick.bind(this));
    };

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
                headerBack.innerHTML = browser.i18n.getMessage('bookmarksFolderBrowserBack');
                list.appendChild(headerBack);
                headerItem.className = 'folder';
                headerItem.dataset.id = tree.id;
                headerItem.innerHTML = browser.i18n.getMessage('bookmarksFolderBrowserSelectThis', tree.title);
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
                    item.innerHTML = folder.title;
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

    isVisible() {
        return this.container.style.display === 'block';
    };

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

    hide() {
        this.container.style.display = 'none';
        document.body.removeEventListener('click', this.hideonBlurBound);
    };

    hideOnBlur(event) {
        let parents = [],
            element = event.target;
        parents.push(element);
        while(element.parentNode) {
            parents.unshift(element.parentNode);
            element = element.parentNode;
        }
        if (!parents.includes(this.container)) {
            this.hide();
        }
    }

    save(id) {
        browser.storage.sync.set({[this.element.id]: id}).then(() => {
            this.setValue(id);
        });
    }

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

const fields = {};

function translate() {
    for (let node of document.querySelectorAll('[data-i18n]')) {
        let [text, attr] = node.dataset.i18n.split('|');
        text = chrome.i18n.getMessage(text);
        attr ? node[attr] = text : node.appendChild(document.createTextNode(text));
    }
}

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

function updatePrefsUI(changes, area) {
    for (let change in changes) {
        if (fields[change].value !== changes[change].newValue) {
            fields[change].setValue(changes[change].newValue);
        }
    }
}

browser.storage.sync.get().then(setupPrefsUI);

