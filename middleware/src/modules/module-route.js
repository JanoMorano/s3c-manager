'use strict';

function route(path, moduleCode, router, middleware = []) {
    return {
        path,
        moduleCode,
        middleware: Array.isArray(middleware) ? middleware : [middleware],
        router,
    };
}

module.exports = { route };
