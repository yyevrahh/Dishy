export class Router {
    constructor() {
        // No longer handling routes for hash changes as it's a single page app
        // The app.js will manage rendering based on authentication state.
    }

    // No longer needed for single-page dashboard
    addRoute(path, templateLoader) {
        // this.routes[path] = templateLoader;
    }

    async handleLocation() {
        // No longer directly handling location or loading templates via router
    }

    navigate(path) {
        // Navigation is now handled internally by app.js state changes
        console.warn("Router.navigate is deprecated in single-page mode. Use app.js state.");
    }
}
