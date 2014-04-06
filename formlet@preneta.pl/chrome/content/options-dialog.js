var FormletOptionsDialog = {
    onDialogLoad: function() {
        this.params = window.arguments[0] || {
            defaults: null,
            result: null
        };

        document.getElementById('saveBlank').checked = this.params.defaults.saveBlank;
        document.getElementById('saveHidden').checked = this.params.defaults.saveHidden;
        document.getElementById('savePasswords').checked = this.params.defaults.savePasswords;
        document.getElementById('saveFormId').checked = this.params.defaults.saveFormId;
    },

    onDialogAccept: function() {
        this.params.result = {
            saveBlank: document.getElementById('saveBlank').checked,
            saveHidden: document.getElementById('saveHidden').checked,
            savePasswords: document.getElementById('savePasswords').checked,
            saveFormId: document.getElementById('saveFormId').checked
        };
        return true;
    }
};
