/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var jsonParser = require('body-parser').json();
var pathRegexp = require('path-to-regexp');

var error = require('../error');
var Access = require('../manager/access');
var checkACL = require('../middleware/auth').checkAccessLevel;

var validator = require('./validator');

var _apiPrivate = {
  handle: true,
  validate: true
};

function sendAPI(res, obj) {
  res.status(200).send(JSON.stringify(obj, function (k, v) {
    if (k in _apiPrivate) return undefined;
    return v;
  }, '  ')+"\n");
}

// Added at the end of each supported method on each defined path.
// Called only if something in handler functions missed some cases
// If requests are fully handled properly, this is never called.
function mustEnd(req, res, next) {
  if (res.headersSent) {
    console.log("Headers sent (%s), but response not ended", res.statusCode);
  } else {
    console.log("Missing response in handlers for %s %s", req.method, req.baseUrl+req.path);
  }
  res.end();
}

module.exports = function buildAPI(router, api) {
  var authHandlers = {};
  function getAuthHandler(authAs) {
    if (!(authAs in authHandlers)) {
      authHandlers[authAs] = checkACL(authAs);
    }
    return authHandlers[authAs];
  }

  // All non-HEAD requests MUST accept 'application/json'
  router.use(function (req, res, next) {
    if (req.method.toLowerCase() !== 'head' && !req.accepts('application/json')) {
      return res.sendStatus(406);
    }
    process.nextTick(next);
  });

  /* root: get full api spec. Nothing else allowed. */
  router.all('/', function apiOpts(req, res) {
    var m = req.method.toLowerCase();
    if (m !== 'get') {
      res.set('Allow', 'GET, OPTIONS');
    }

    if (m !== 'get' && m !== 'options') {
      return error.sendError(res, 405, 'notallowed', "Method Not Allowed", {
        method: req.method,
        allow: ['GET', 'OPTIONS']
      });
    }

    sendAPI(res, {
      namespace: 'net.vdust.filehub.api',
      basePath: req.baseUrl,
      'content-type': 'application/json',
      root: true,
      api: api
    });
  });

  api.forEach(function (def, i) {
    var methods = ['OPTIONS'];
    var methodsMap = { OPTIONS: true };
    var authHandler;
    var ptre, keys;

    if (!def.path) {
      console.log("Missing path in api definition (at index "+i+")");
      return;
    }

    if (def.path === '/') {
      console.log("Definition for root path ignored (handled automatically)");
      return;
    }

    var route = router.route(def.path);

    // OPTIONS handler
    route.options(function (req, res) {
      res.status(200);
      res.set('Allow', methods.join(', '));
      sendAPI(res, {
        namespace: "net.vdust.filehub.api",
        basePath: req.baseUrl,
        'content-type': 'application/json',
        api: [ def ]
      });
    });

    if (def.authAs) {
      authHandler = getAuthHandler(def.authAs);
    }

    if (def.params) {
      // Validate parameters in url
      route.all(validator.data('params', def.params));
    }

    if (def.handle) {
      // Add global pre-process handlers (even for unsupported methods)
      // Won't force inclusion of route if no method is defined
      // NOTE: Occur before authentication checks (if any).
      route.all(def.handle);
    }

    Object.keys(def.methods||{}).forEach(function (m) {
      var mDef = def.methods[m];
      m = m.toLowerCase();
      var mUC = m.toUpperCase();
      var methodFn = route[m].bind(route);
      var fn = mDef.handle;
      var mAuthHandler = authHandler;
      var handlers = [];

      if (typeof methodFn !== 'function') {
        throw new Error("Method "+mUC+" not supported ("+def.path+")");
      }

      if (!fn || (Array.isArray(fn) && !fn.length)) {
        console.log("Missing handlers for %s %s", mUC, def.path);
        return;
      }

      if (!methodsMap[mUC]) {
        methods.push(mUC);
        methodsMap[mUC] = true;
      } else {
        console.log("Method %s already defined for %s", mUC, def.path);
      }

      if (mDef.authAs && Access.compare(mDef.authAs, def.authAs) > 0) {
        mAuthHandler = getAuthHandler(mDef.authAs);
      }
      if (mAuthHandler) {
        handlers.push(mAuthHandler);
      }

      if (mDef.body) {
        handlers.push([jsonParser, validator.body(mDef.body)]);
      }

      if (mDef.query) {
        handlers.push(validator.data('query', mDef.query));
      }

      handlers.push([fn, mustEnd]);

      methodFn(handlers);
    });

    if (methods.length === 1) { // OPTIONS method only
      console.log("Api definition for path '"+def.path+"' has no handler on any method");
      // The last route added is the one created above.
      router.stack.pop();
    } else {
      // Means that no other method handler was called (ensure response)
      route.all(function (req, res) {
        res.set('Allow', methods.join(', '));
        error.sendError(res, 405, 'notallowed', "Method Not Allowed", {
          method: req.method,
          allow: methods
        });
      });
    }
  });

  /* Unknown api */
  router.use(function (req, res, next) {
    next(error.notFound('api.notfound', "API Not Found"));
  });

  // ApiError handler
  router.use(error);
};
