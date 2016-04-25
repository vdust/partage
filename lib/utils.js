/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var resolve = require('path').resolve;

var i18n = require('./i18n');

function deprecate(fn) {
  return function () {
    if (fn.name) console.warn("Function %s is deprecated", fn.name);
    return fn.apply(this, arguments);
  }
}

function cleanIterable(iterable) {
  return Array.prototype.filter.call(iterable, function (v) {
    return v !== undefined;
  });
}
function cleanEnumerable() { return cleanIterable.apply(this, arguments); }

function cleanStack(stack) {
  return stack.split('\n').slice(1).map(function (s) {
    return s.trim();
  });
}

function compareFileLowerCase(af, bf) {
  var a = typeof af === 'string' ? af : af.name,
      b = typeof bf === 'string' ? bf : bf.name;
  var ai = a.toLowerCase(), bi = b.toLowerCase();
  return ai < bi ? -1 : (ai > bi ? 1 : (a < b ? -1 : (a > b ? 1 : 0)));
}

function comparePath(p1, p2) {
  var cmp = 0,
      sp1 = p1.split('/'),
      l1 = sp1.length,
      sp2 = p2.split('/'),
      l2 = sp2.length,
      i;
  for (i = 0; !cmp && i < l1 && i < l2; i++) {
    cmp = compareFileLowerCase(sp1[i], sp2[i]);
  }
  return cmp ? cmp : (l1 < l2 ? -1 : (l1 > l2 ? 1 : 0));
}

function decodeSafeBase64(string, enc) {
  var buffer = new Buffer(string.replace(/_/g, '/').replace(/-/g, '+'), 'base64');
  return buffer.toString(enc||'utf-8');
}

function encodeSafeBase64(string) {
  var buffer = new Buffer(string);
  return buffer.toString('base64').replace(/\//g, '_').replace(/\+/g, '-');
}

function error(httpCode, prefix, msg, details) {
  if (typeof httpCode !== 'number') {
    details = msg;
    msg = prefix;
    prefix = code;
    httpCode = undefined;
  }

  if (typeof msg !== 'string') {
    details = msg;
    msg = prefix;
    prefix = '';
  }

  var e = new Error(prefix + (prefix ? ': ' : '') + msg);
  Error.captureStackTrace(e, error);
  if (httpCode) e.status = e.statusCode = httpCode;
  e.details = details;
  return e;
}

function formatSize(size) {
  var s, units = 'ukmgt'.split(''), u = -1;

  do {
    s = size;
    u++;
    size = size / 1024;
  } while (u < units.length - 1 && size > 0.9);

  if (s < 10 && u) {
    s = Math.round(s * 10)/10;
  } else {
    s = Math.round(s);
  }

  return ''+s+' '+i18n.t('filehub.size.'+units[u]);
}

function merge(recursive, dest) {
  var args = Array.prototype.slice.call(arguments, 1);

  if (typeof recursive !== 'boolean') {
    dest = recursive;
    recursive = false;
  } else {
    args.shift();
  }

  args.forEach(function (obj) {
    if (obj === undefined || obj === null) return;
    var v, k, i, keys = Object.keys(obj);
    for (i = 0; i < keys.length; i++) {
      k = keys[i];
      v = obj[k];

      if (!recursive || typeof dest[k] !== 'object' || Array.isArray(dest[k])) {
        dest[k] = null;
      }

      if (!recursive || typeof v !== 'object' || Array.isArray(v) || !dest[k]) {
        dest[k] = v;
      } else {
        merge(true, dest[k], v);
      }
    }
  });

  return dest;
}

function partition(string, sep) {
  var p = string.indexOf(sep);
  if (p < 0) return [ string, '', '' ];
  return [ string.substr(0, p), sep, string.substr(p + sep.length) ];
}

function regexpEscape(string) {
  return string.replace(/([$^\\.(|)\[\]{}*+?])/g, '\\$1');
}

function validateType(type, v, ctx, code, key) {
  ctx = (ctx || '').replace(/\.$/, '');
  if (ctx) ctx += '.';

  function _err(err, extra) {
    extra = extra || {};
    extra.code = ctx + code;
    extra.key = key;
    extra.expect = type;
    return error(ctx + key, err, extra);
  }

  switch (type) {
    case 'number':
      v = +v;
      if (isNaN(v)) {
        throw _err("Not a number");
      }
      break;
    case 'flag':
      v = typeof v === 'boolean' ? v : !!+v;
      break;
    case 'array':
      if (typeof v === 'string') {
        // Required for array parameters in query that appear only once
        // (possibly without value)
        if (!v) {
          v = [];
        } else if (param.split) {
          v = v.trim().split(new RegExp("\\s*"+param.split+"\\s*"));
        } else {
          v = [ v ];
        }
      } else if (!Array.isArray(v)) {
        throw _err("Expected array, got " + typeof v, { got: typeof v });
      }
      break;
    case 'glob':
      try {
        v = require('minimatch').makeRe(v);
      } catch (e) {
        throw _err(e.message || (''+e));
      }
      break;
    case 'regexp':
      if (typeof v !== 'string') {
        throw _err("Expected regular expression (string), git "+typeof v, {
          got: typeof v
        });
      }
      try {
        v = new RegExp(v);
      } catch (e) {
        throw _err("Invalid regular expression");
      }
      break;
    default:
      break;
  }

  return v;
}

/**
 * ValidateFields([ctx,] obj, definitions)
 *
 * Validate properties of an object against definitions
 *
 * Throws an error object if any property doesn't validate.
 * (see utils.error() for error object properties)
 *
 * @param ctx
 *        A context string used in error messages. Optional.
 * @param obj
 *        An object to check fields from.
 * @param definitions
 *        An object associating property names with their definitions
 *        A property definition can contain the following properties (default
 *        values provided when not set):
 *          { required: false,
 *            validate: function () { return true; },
 *            type: 'string' }
 */
function validateProperties(ctx, obj, definitions) {
  if (typeof ctx !== 'string') {
    definitions = obj;
    obj = ctx;
    ctx = '';
  }

  ctx += ctx && '.';
  obj = obj || {};

  var keys = Object.keys(definitions);
  var i, key, prop, type, v;

  for (i = 0; i < keys.length; i++) {
    key = keys[i];
    prop = definitions[key];

    if (key in obj) {
      obj[key] = v = validateType(prop.type, obj[key], ctx, 'prop.type', key);

      if (typeof prop.validate === 'function') {
        try {
          prop.validate(v);
        } catch (e) {
          if (!e.details) e.details = {};
          e.details.code = ctx+'prop.'+(e.details.code || 'validate');
          e.details.prop = key;
          throw error(ctx+key, "Failed to validate property: "+e.message, e.details);
        }
      } else if (prop.validate) {
        // Don't fail. just print a debug message and ignore it.
        console.log("validator for property '%s' is not a function", ctx+key);
      }
    } else if (prop.required) {
      throw error(ctx+key, "Property required", {
        code: ctx+'prop.required',
        prop: key
      });
    }
  }
}

function _data(resCode, msg) {
  if (typeof resCode === 'object') {
    return {
      error: resCode.message || "Unexpected error",
      details: resCode.details || {
        code: 'unexpected'
      }
    }
  } else {
    return {
      error: msg,
      details: {
        code: resCode
      }
    }
  }
}

function _send(res, status, payload) {
  res.status(status);
  if (res.req.method === 'HEAD') {
    res.end();
  } else {
    res.send(payload);
  }
}

function sendError(res, error) {
  _send(res, error.statusCode || 500, _data(error));
}

function forbidden(res, resCode, msg) {
  _send(res, 403, _data(resCode || 'forbidden', msg || "Forbidden"));
}

function notFound(res, resCode, msg) {
  _send(res, 404, _data(resCode || 'notfound', msg || "Not Found"));
}

function conflict(res, resCode, msg) {
  _send(res, 409, _data(resCode || 'conflict', msg || "Conflict"));
}

function unexpected(res) {
  _send(res, 500, _data(resCode || 'unexpected', msg || "Unexpected error"));
}

function notImplemented(res, resCode, msg) {
  _send(res, 501, _data(resCode || 'notimplemented', msg || "Not implemented"));
}

module.exports = {
  cleanEnumerable: deprecate(cleanEnumerable),
  cleanIterable: cleanIterable,
  cleanStack: cleanStack,
  compareFileLowerCase: compareFileLowerCase,
  compareResource: compareFileLowerCase,
  comparePath: comparePath,
  deprecate: deprecate,
  decodeSafeBase64: decodeSafeBase64,
  encodeSafeBase64: encodeSafeBase64,
  formatSize: formatSize,
  merge: merge,
  partition: partition,
  regexpEscape: regexpEscape,
  validateProperties: validateProperties,
  validateType: validateType,
  // TODO: remove from here (see error.js)
  error: deprecate(error),
  sendError: deprecate(sendError),
  conflict: deprecate(conflict),
  forbidden: deprecate(forbidden),
  notFound: deprecate(notFound),
  notImplemented: deprecate(notImplemented),
  unexpected: deprecate(unexpected)
};
