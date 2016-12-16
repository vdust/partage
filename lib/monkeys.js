/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

/* 
 * Monkey patch express to use path-to-regexp 1.2.x with Router.route()
 * (Router.use() still uses 0.1.x)
 */

var pathRegexp = require('path-to-regexp');
var Router = require('express/lib/router');
var _route = Router.route;

Router.route = function route(path) {
  var pathKeys = [];
  var pathRe = pathRegexp(path, pathKeys, {
    sensitive: this.caseSensitive,
    strict: this.strict,
    end: true
  });

  var route = _route.call(this, pathRe);

  if (pathKeys.length) {
    // Replace numeric params with named ones.
    if (this.mergeParams) {
      // Because numeric params could be inherited from parent router,
      // the override can have side effects in this case, so we warn about it
      // just in case.
      console.warn("WARNING: Router uses mergeParams = true, but the Router.route() override for path-to-regexp 1.2.x will not merge numeric params correctly if any appear in the parent.");
    }

    route.all(function (req, res, next) {
      for (var i = 0; i < pathKeys.length; i++) {
        req.params[pathKeys[i].name] = req.params[i];
      }
      next();
    });
  }

  return route;
};
