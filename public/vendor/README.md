# Map dependencies

Leaflet 1.9.4 and Leaflet.markercluster 1.5.3 are vendored from their pinned npm distributions. Their MIT licences are included beside the source.

The markercluster JavaScript has a small outer `function(L)` wrapper because NAVO's existing application state is also named `L`. Leaflet is captured separately through `window.L.noConflict()`; upstream plugin behaviour is otherwise unchanged.

Tiles are loaded for the visible viewport from OpenStreetMap with visible attribution, normal browser caching and no offline prefetch. Project names, health status and markers are rendered locally, not sent to the tile server. Demo positions are explicitly labelled.
