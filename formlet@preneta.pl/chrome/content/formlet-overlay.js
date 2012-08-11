"use strict";
/**
 * Formlet pseudo-class object
 *
 * @class
 */
var Formlet = {
    addonId: 'formlet@preneta.pl',
    /**
     * Initialization routine
     */
    init: function() {
        this.prefs = Services.prefs.getBranch("extensions.formlet.");
        // load translations
        this.strings = document.getElementById('formlet-strings');
        // listen to context menu
        document.getElementById('contentAreaContextMenu').addEventListener('popupshowing', this.showFirefoxContextMenu.bind(this), false);
        // listen to options
        Services.obs.addObserver(this.optionsDisplayed.bind(this), 'addon-options-displayed', false);
        Services.obs.addObserver(this.optionsHidden.bind(this), 'addon-options-hidden', false);
    },

    /**
     * Gets bookmark folder id from preferences.
     * If it is not set yet - sets it to Bookmarks Toolbar Folder
     *
     * @return {Number} Bookmark folder id
     */
    getStorageFolder: function() {
        var id = this.prefs.getIntPref('bookmarksFolder');
        if (id === 0 ) {
            id = PlacesUtils.toolbarFolderId;
            this.prefs.setIntPref('bookmarksFolder', id);
        }
        return id;
    },

    /**
     * Generates folder path using folder names
     *
     * @param {Number} [folderId]
     *
     * @return {String} Folders path
     */
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

    /**
     * Saves bookmark folder
     *
     * @param {Number} folderId
     */
    setStorageFolder: function(folderId) {
        if (folderId > 0 ) {
            this.prefs.setIntPref('bookmarksFolder', folderId);
        }
    },

    /**
     * Evaluates bookmarks title pattern from preferences, replacing possible dynamic elements
     *
     * @param {String} title Document title
     *
     * @return {String} Parsed title
     */
    getBookmarkTitle: function(title) {
        var pattern = this.prefs.getCharPref('titlePattern');
        pattern = pattern.replace('{TITLE}', title).replace('{DATE}', (new Date()).toLocaleString());
        return pattern;
    },

    /**
     * Calls options dialog and returns use choice
     *
     * @return {Object} Options object
     */
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

    /**
     * Displays options dialog to user
     *
     * @param {Object} defaults Options from preferences
     * @return {Object|Null} Options changed by user or null on dialog cancel
     */
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

    /**
     * Controls Formlet context menu item and hides it, when context menu is called outside of form element
     *
     * @param {Event} event
     */
    showFirefoxContextMenu: function(event) {
        // show menu item only when inside forms
        var element = gContextMenu.target,
            show = false;

        if (element) {
            while (element && element.parentNode && element.nodeName.toLowerCase() !== 'form') {
                element = element.parentNode;
            }
            show = element.nodeName.toLowerCase() === 'form';
        }

        document.getElementById('context-formlet').hidden = !show;
    },

    /**
     * Handles context menu command and saves selected form to bookmark
     *
     * @param {Event} event
     */
    saveForm: function(event) {
        var form = gContextMenu.target,
            options = this.getOptions(),
            code;
        if (!form || !options) {
            return;
        }
        while (form.parentNode && form.nodeName.toLowerCase() !== 'form') {
            form = form.parentNode;
        }
        if (form.nodeName.toLowerCase() === 'form') {
            code = Object.create(Formlet.Serializer).init(form, options);
            this.saveBookmark(code);
        }
    },

    /**
     * Saves bookmarklet
     * Depending on preferences - creates new bookmark using default preferences
     * or shows user bookmark dialog,
     *
     * @param {String} code Bookmarklet code with serialized form
     */
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
                title: bookmarkTitle,
                hiddenRows: ['description' , 'location' , 'loadInSidebar' , 'keyword']
            }, window);
        } else {
            PlacesUtils.bookmarks.insertBookmark(
                folderId, // The id of the folder the bookmark will be placed in.
                bookmarkURI,             // The URI of the bookmark - an nsIURI object.
                PlacesUtils.bookmarks.DEFAULT_INDEX, // The position of the bookmark in its parent folder.
                bookmarkTitle
            );
        }
    },

    /**
     * Binds event observer for bookmark folder control on Formlet options display event
     *
     * @param aSubject
     * @param aTopic
     * @param aData
     */
    optionsDisplayed: function(aSubject, aTopic, aData) {
        if (aTopic == 'addon-options-displayed' && aData == this.addonId) {
            var control = aSubject.getElementById('bookmarksFolder-control'),
                params = {
                    selected: this.getStorageFolder(),
                    result: null
                };
            control.label = this.getStorageFolderPath();
            this.showFoldersDialogBound = this.showFoldersDialog.bind(this, params);
            control.addEventListener('click', this.showFoldersDialogBound);
        }
    },

    /**
     * Removes observer bind by {#optionsDisplayed}
     * @param aSubject
     * @param aTopic
     * @param aData
     */
    optionsHidden: function(aSubject, aTopic, aData) {
        if (aTopic == 'addon-options-hidden' && aData == this.addonId) {
            var control = aSubject.getElementById('bookmarksFolder-control');
            if (control) {
                control.removeEventListener('click', this.showFoldersDialogBound);
            }
        }
    },

    /**
     * Handler for bookmark folder control in Formlet preferences
     * Shows bookmark folder tree and updates preferences on new folder selection.
     *
     * @param {Object} params           Params for folders dialog
     * @param {String} params.selected  Current folder id from preferences
     * @param {Null}   params.result    Empty entry for dialog return value
     * @param {Event}  event
     */
    showFoldersDialog: function(params, event) {
        window.openDialog(
            'chrome://formlet/content/folders-dialog.xul',
            'FormletFoldersDialog',
            'chrome, resizable, modal, centerscreen',
            params
        );
        if (params.result && params.result > 0) {
            this.setStorageFolder(params.result);
            event.target.label = this.getStorageFolderPath();
        }
    }
};

// Call Formlet initialization routine on firefox load
window.addEventListener('load', function() { Formlet.init(); }, false);

/**
 * Form serializer.
 * Serializes form to JSON-formatted data and generates code for bookmarklet
 * containing {formFiller} function with form data passed as argument
 *
 * @class
 */
Formlet.Serializer = {
    /**
     * Initialize sterilizer routine
     *
     * @param {HTMLElement} form                    Form element to serialize
     * @param {Object}      options                 {Formlet} options object
     * @param {Boolean}     options.saveBlank
     * @param {Boolean}     options.saveHidden
     * @param {Boolean}     options.savePasswords
     *
     * @return {String} Bookmarklet code
     */
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

    /**
     * Generates form selector using it's id or position inside document
     *
     * @return {String} Form selector
     */
    getFormSelector: function() {
        var selector;
        if (this.form.id) {
            selector = '#' + this.form.id;
        } else {
            selector = 'form:nth-of-type('+ this.index + 1 +')';
        }
        return selector;
    },

    /**
     * Serialize form to array.
     * Each element is represented by array with following structure:
     *  [
     *      name,   // element name
     *      index,  // index for elements with non-unique names (eg "array[]")
     *      method, // method for setting the value (setValue, setChecked, setSelected)
     *      args    // value for element (string for setValue, bool for setChecked, array of strings for setSelected)
     *  ]
     *
     * @return {Array} Array of arrays with elements data
     */
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
            if (elements.namedItem(name) && Object.prototype.toString.call(elements.namedItem(name)) === '[object NodeList]') {
                index = Array.prototype.slice.call(elements.namedItem(name)).indexOf(element);
            }
            if (element.nodeName.toLowerCase() === 'select') {
                method = 'setSelected';
                args = [];
                for (var o = 0; o < element.options.length; o++) {
                    if (element.options[o].selected) {
                        args.push(element.options[o].value);
                    }
                }
                blank = !args.length;
            } else if (element.nodeName.toLowerCase() === 'input' && ['radio', 'checkbox'].indexOf(element.type) >= 0) {
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

    /**
     * Creates code for bookmarklet
     *
     * @return {String} Bookmarklet code
     */
    save: function() {
        this.code = 'javascript:' + Formlet.formFiller.toSource() +'(' + JSON.stringify(this.data) + ')';
        return this.code;
    }
};

/**
 * Form filling function.
 * Takes form data in the following format
 *  {
 *      'form': 'selector',     // form selector
 *      'elements': [           // array of arrays with elements data
 *          [
 *              name,           // element name
 *              index,          // index for elements with non-unique names (eg "array[]")
 *              method,         // method for setting the value (setValue, setChecked, setSelected)
 *              args            // value for element (string for setValue, bool for setChecked, array of strings for setSelected)
 *           ],
 *          [...]
 *       ]
 *  }
 * @param {Object} data Form data
 */
Formlet.formFiller = function(data) {
    /**
     * Placeholder for internal methods
     * @type {Object}
     */
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
    var form = document.querySelector(data.form),
        elements = data.elements;
    for (var i = 0; i < elements.length; i++) {
        try {
            // get element by it's name stored in 0 array item and optional index stored in 1 array element
            var element = methods.getElement(form, elements[i][0], elements[i][1]);
            // call method stored in 2 array item with args stored in 3 array item
            methods[elements[i][2]](element, elements[i][3]);
        } catch(e) {}
    }
};
