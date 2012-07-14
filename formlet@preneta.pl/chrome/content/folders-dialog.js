var FormletFoldersDialog = {
    onDialogLoad: function() {
        this.params = window.arguments[0] || {
            selected: null,
            result: {}
        };

        //Run the query
        var options = PlacesUtils.history.getNewQueryOptions();
        options.excludeItems = true;
        options.excludeQueries = true;
        options.excludeReadOnlyFolders = true;
        var query = PlacesUtils.history.getNewQuery();
        query.setFolders([PlacesUtils.placesRootId], 1);
        var result = PlacesUtils.history.executeQuery(query, options);

        //Populate the tree
        var tree = document.getElementById('bookmarksFolders');
        tree.place = PlacesUtils.history.queriesToQueryString([query], 1, options);
        tree.selectItems([this.params.selected]);
    },

    onDialogAccept: function() {
        var folder = document.getElementById('bookmarksFolders').selectedNode,
            id = PlacesUtils.getConcreteItemId(folder);
        this.params.result = {selected: id};
        return true;
    }
};
