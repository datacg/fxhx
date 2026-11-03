FX.Model = {
    state: function () {
        return {
            schemaVersion: 2,
            product: 'FX Exchanger',
            preferences: { scope: 'active', groupBy: 'type' }
        };
    },
    migrate: function (state) {
        FX.Validate.state(state);
        var s = FX.U.clone(state);
        if (s.schemaVersion === 1) {
            s.schemaVersion = 2;
            if (
                s.preferences.groupBy !== 'effect' &&
                s.preferences.groupBy !== 'type'
            ) {
                s.preferences.groupBy = 'type';
            }
        }
        if (
            s.preferences.scope === 'selected' ||
            s.preferences.scope === 'manual'
        ) {
            // Composition IDs are session-local; never restore an empty manual scope.
            s.preferences.scope = 'active';
        }
        return s;
    },
    layerKey: function (x) {
        var id = x.layerId;
        if (id === null || id === undefined) {
            id = 'index-' + x.layerIndex;
        }
        return x.compId + '/' + id;
    },
    effectKey: function (x) {
        return FX.Model.layerKey(x) + '/fx-' + x.effectIndex;
    }
};
