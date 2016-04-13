/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var Access = require('../manager/access');

function _sendError(res, code, error, template, args) {
  res.status(code);
  if (template) {
    res.render(template, args || {});
  } else {
    res.send({ error: error });
  }
}

/* checkAuth([errCode] [, template [, args]]) */
function checkAuth(errCode, template, args) {
  if (typeof (errCode) !== 'number') {
    args = template;
    template = errCode;
    errCode = 403;
  }

  return function checkAuthHandler(req, res, next) {
    if (typeof req.isAuthenticated !== 'function' || !req.isAuthenticated()) {
      return _sendError(res, errCode, "Authenticated user required", template, args);
    }
    process.nextTick(next);
  };
};

/* checkAccessLevel(level [, errCode] [, template [, args]]) */
function checkAccessLevel(level, errCode, template, args) {
  var errMessage = "Require "+level+" rights";

  if (typeof level !== 'string') {
    throw new Error("Access level must be a string");
  } else if (!Access.level(level)) {
    throw new Error("Unknown access level '"+level+"'");
  }

  if (typeof (errCode !== 'number')) {
    args = template;
    template = errCode;
    errCode = 403;
  }

  return function checkAccessLevelHandler(req, res, next) {
    if (!req.user || !req.user.is(level)) {
      return _sendError(res, errCode, errMessage, template, args);
    }
    process.nextTick(next);
  };
};

module.exports = {
  checkAuth: checkAuth,
  checkAccessLevel: checkAccessLevel
};
