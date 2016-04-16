/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var createError = require('../error').createError;

var Access = {
  LEVELS: {
    visitor: 1,
    contributor: 20, // 4
    admin: 50, // 10
    special: 80,
    su: 99
  },
  BYNUM: {},
  compare: function cmp(l1, l2) {
    var delta = Access.level(l1) - Access.level(l2);
    return delta < 0 ? -1 : (delta > 0 ? 1 : 0);
  },
  limit: function limit(lvl, limit, loose) {
    var delta = Access.level(lvl) - Access.level(limit);
    return loose ? delta <= 0 : delta < 0;
  },
  get: function get(name) {
    return Access.LEVELS[name] || 0;
  },
  name: function name(lvl) {
    return Access.BYNUM[+lvl];
  },
  level: function level(lvl) {
    return isNaN(+lvl) ? Access.get(lvl) : +lvl;
  },
  list: function list(limit) {
    var a = Object.keys(Access.LEVELS);
    limit = arguments.length === 0 ? 'special' : limit;
    if (limit && Access.LEVELS[limit]) {
      a = a.filter(function (l) {
        return Access.LEVELS[l] < Access.LEVELS[limit];
      });
    }
    return a.sort(Access.compare);
  },
  checkLevel: function checkLevel(lvl, limit) {
    var ctx = typeof this === 'string' ? this : 'access.';

    if (arguments.length === 1) limit = 'special';

    var _lvl = Access.level(lvl);
    var r = _lvl > 0 && (!limit || _lvl < Access.LEVELS[limit]);

    if (!r) {
      var code, msg, extra;
      if (limit && !Access.LEVELS[limit]) {
        console.log("Unknown level limit '"+limit+"'");
        throw new Error("Unknown access level limit '"+limit+"'");
      } else if (!(_lvl > 0)) {
        code = 'unknown';
        msg = "Unknown access level '"+lvl+"'";
        extra = {
          available: Access.list(limit),
          got: lvl
        };
      } else {
        code = 'invalid';
        msg = "Access level not allowed";
        extra = {
          allowed: Access.list(limit),
          got: lvl
        };
      }
      throw createError(400, ctx+code, msg, extra);
    }
  }
};

Object.keys(Access.LEVELS).forEach(function (k) {
  var n = Access.LEVELS[k];
  Access.BYNUM[''+n] = k;
});

module.exports = Access;
