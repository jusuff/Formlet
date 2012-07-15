"use strict";
var Formlet = {
    addonId: 'formlet@preneta.pl',
    onLoad: function() {
        this.__check = 'formlet';
        this.initialized = true;
        this.prefs = Services.prefs.getBranch("extensions.formlet.");
        // load translations
        this.strings = document.getElementById('formlet-strings');
        // listen to context menu
        document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this.showFirefoxContextMenu.bind(this), false);
        // listen to options
        Services.obs.addObserver(this.optionsDisplayed.bind(this), 'addon-options-displayed', false);
        Services.obs.addObserver(this.optionsHidden.bind(this), 'addon-options-hidden', false)
    },

    getStorageFolder: function() {
        var id = this.prefs.getIntPref('bookmarksFolder');
        if (id === 0 ) {
            id = PlacesUtils.toolbarFolderId;
            this.prefs.setIntPref('bookmarksFolder', id);
        }
        return id;
    },

    getStorageFolderPath: function(folderId) {
        folderId = folderId || this.getStorageFolder();
        var id = folderId || PlacesUtils.placesRootId,
            title = PlacesUtils.bookmarks.getItemTitle(id),
            parent = id,
            path = [title];
        while ((parent = PlacesUtils.bookmarks.getFolderIdForItem(parent)) && parent !== PlacesUtils.placesRootId) {
            path.push(PlacesUtils.bookmarks.getItemTitle(parent));
        }
        return path.reverse().join('/');
    },

    setStorageFolder: function(folderId) {
        if (folderId > 0 ) {
            this.prefs.setIntPref('bookmarksFolder', folderId);
        }
    },

    getBookmarkTitle: function(title) {
        var pattern = this.prefs.getCharPref('titlePattern');
        pattern = pattern.replace('{TITLE}', title).replace('{DATE}', (new Date()).toLocaleString());
        return pattern;
    },

    getOptions: function() {
        var defaults = {
                saveBlank: this.prefs.getBoolPref('saveBlank'),
                saveHidden: this.prefs.getBoolPref('saveHidden'),
                savePasswords: this.prefs.getBoolPref('savePasswords')
            },
            showOptionsDialog = this.prefs.getBoolPref('showDialog'),
            options;
        if (showOptionsDialog) {
            options = this.showOptionsDialog(defaults);
        } else {
            options = defaults;
        }
        return options;
    },

    showOptionsDialog: function(defaults) {
        var params = {
            defaults: defaults,
            result: null
        };
        window.openDialog(
            'chrome://formlet/content/options-dialog.xul',
            'FormletOptionsDialog',
            'chrome, resizable, modal, centerscreen',
            params
        );
        return params.result;
    },

    showFirefoxContextMenu: function(event) {
        // show menu item only when inside forms
        var element = gContextMenu.target,
            show;
        while (element.parentNode && element.nodeName !== 'FORM') {
            element = element.parentNode;
        }
        show = element.nodeName === 'FORM';
        // todo - sometimes its shown outside forms - popupshowing seems to be not fired on some elements - eg buttons and keyboard menu
//        __alert(element.nodeName);
        document.getElementById('context-formlet').hidden = !show;
    },

    saveForm: function(event) {
        var form = gContextMenu.target,
            options = this.getOptions(),
            code;
        if (!options) {
            return;
        }
        while (form.parentNode && form.nodeName !== 'FORM') {
            form = form.parentNode;
        }
        if (form.nodeName === 'FORM') {
            code = Object.create(Formlet.Serializer).init(form, options);
            this.saveBookmark(code);
        }
    },

    saveBookmark: function(code) {
        var showBookmarksDialog = this.prefs.getBoolPref('showBookmarksDialog'),
            bookmarkURI = Services.io.newURI(code, null, null),
            folderId = this.getStorageFolder(),
            bookmarkTitle = this.getBookmarkTitle(content.document.title);
        if (showBookmarksDialog) {
            var folder = new InsertionPoint(folderId, PlacesUtils.bookmarks.DEFAULT_INDEX, Ci.nsITreeView.DROP_ON);
            PlacesUIUtils.showBookmarkDialog({
                action: 'add',
                type: 'bookmark',
                uri: bookmarkURI,
                defaultInsertionPoint: folder,
                title: 'DIALOG ' + bookmarkTitle,
                hiddenRows: ['description' , 'location' , 'loadInSidebar' , 'keyword']
            }, window);
        } else {
            PlacesUtils.bookmarks.insertBookmark(
                folderId, // The id of the folder the bookmark will be placed in.
                bookmarkURI,             // The URI of the bookmark - an nsIURI object.
                PlacesUtils.bookmarks.DEFAULT_INDEX, // The position of the bookmark in its parent folder.
                'QUIET ' + bookmarkTitle
            );
        }
    },


    optionsDisplayed: function(aSubject, aTopic, aData) {
        if (aTopic == 'addon-options-displayed' && aData == this.addonId) {
            var control = aSubject.getElementById('bookmarksFolder-control'),
                params = {
                    selected: this.getStorageFolder(),
                    result: {}
                };
            control.label = this.getStorageFolderPath();
            this.showFoldersDialogBound = this.showFoldersDialog.bind(this, params);
            control.addEventListener('click', this.showFoldersDialogBound);
        }
    },

    optionsHidden: function(aSubject, aTopic, aData) {
        if (aTopic == 'addon-options-hidden' && aData == this.addonId) {
            var control = aSubject.getElementById('bookmarksFolder-control');
            if (control) {
                control.removeEventListener('click', this.showFoldersDialogBound);
            }
        }
    },

    showFoldersDialog: function(params, event) {
        window.openDialog(
            'chrome://formlet/content/folders-dialog.xul',
            'FormletFoldersDialog',
            'chrome, resizable, modal, centerscreen',
            params
        );
        if ('selected' in params.result && params.result.selected > 0) {
            this.setStorageFolder(params.result.selected);
            event.target.label = this.getStorageFolderPath();
        }
    }
};

Formlet.Serializer = {
    init: function(form, options) {
        this.form = form;
        this.options = options;
        this.index = Array.prototype.slice.call(form.ownerDocument.forms).indexOf(form);
        this.data = {
            form: this.getFormSelector(),
            elements: this.serialize()
        };
        return this.save();
    },
    getFormSelector: function() {
        var selector;
        if (this.form.id) {
            selector = '#' + this.form.id;
        } else {
            selector = 'form:nth-of-type('+ this.index + 1 +')';
        }
        return selector;
    },
    serialize: function() {
        var elements = this.form.elements,
            disallowedTypes = ['submit', 'reset', 'button', 'file'],
            data = [];
        if (!this.options.savePasswords) {
            disallowedTypes.push('password');
        }
        if (!this.options.saveHidden) {
            disallowedTypes.push('hidden');
        }
        for (var i = 0; i < elements.length; i++) {
            var element = elements[i],
                name = element.name || null,
                index = null,
                method = 'setValue',
                args = element.value,
                blank = !element.value;

            if (!name || disallowedTypes.indexOf(element.type) >= 0) {
                continue;
            }
            if (elements.namedItem(name) && elements.namedItem(name).length) {
                index = Array.prototype.slice.call(elements.namedItem(name)).indexOf(element);
            }
            if (element.nodeName === 'SELECT') {
                method = 'setSelected';
                args = [];
                for (var o = 0; o < element.options.length; o++) {
                    if (element.options[o].selected) {
                        args.push(element.options[o].value);
                    }
                }
                blank = args.length; // todo - empty arrays seems to be saved
            } else if (element.nodeName === 'INPUT' && ['radio', 'checkbox'].indexOf(element.type) >= 0) {
                method = 'setChecked';
                args = !!element.checked;
                blank = !args;
            }
            if (this.options.saveBlank || !blank) {
                data.push([name, index, method, args]);
            }
        }
        return data;
    },
    save: function() {
        this.code = 'javascript:(' + formFiller.toSource() +')(\'' + JSON.stringify(this.data) + '\')';
        return this.code;
    }
};

window.addEventListener('load', function() { Formlet.onLoad(); }, false);


/**
 * Fills from
 *  forms = {
 *      'form': 'selector',
 *      'elements': [
 *          [name, index, method, args]
 *       ]
 *  }
 * @param {String} data Form data
 */
function formFiller(data) {
    var methods = {
        /**
         * Gets form element by name or index; for non-unique names (arrays) 3rd param should be passed
         *
         * @param {HTMLFormElement} form
         * @param {String|Number}   name    name attr or index
         * @param {Number}          [index]
         * @return {HTMLInputElement|HTMLTextAreaElement|HTMLSelectElement}
         */
        getElement: function(form, name, index) {
            return form[name][index] || form[name];
        },
        /**
         * Set value for text-like inputs and textareas
         * @param {HTMLInputElement|HTMLTextAreaElement} element
         * @param {String} value
         */
        setValue: function(element, value) {
            element.value = value;
        },
        /**
         * Set value for checkbox and radio inputs
         * @param {HTMLInputElement} element
         * @param {Boolean} value
         */
        setChecked: function(element, value) {
            element.checked = !!value;
        },
        /**
         * Set value for selects
         * @param {HTMLSelectElement} element
         * @param {Array} values
         */
        setSelected: function(element, values) {
            var options = element.options;
            for (var i = 0; i < options.length; i++) {
                options[i].selected = values.indexOf(options[i].value) >= 0;
            }
        }
    };

    // decode data
    data = JSON.parse(data);
    var form = document.querySelector(data.form),
        elements = data.elements;
    for (var i = 0; i < elements.length; i++) {
        try {
            var element = methods.getElement(form, elements[i][0], elements[i][1]);
            // call method stored in 2 array item with args stored in 3 array item
            methods[elements[i][2]](element, elements[i][3]);
        } catch(e) {}
    }
}

///////////////// DEBUG!!!!!!!!!!!

function __alert(msg, json) {
    if (json) {
        try {
            msg = JSON.stringify(msg);
        } catch (e) {}
    }
    Services.prompt.alert(window, '__alert', msg);
}

