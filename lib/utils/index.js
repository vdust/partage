/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';


module.exports = {
  asyncLog: asyncLog,
  cleanIterable: cleanIterable,
  cleanStack: cleanStack,
  deprecate: deprecate,
  keyValue: keyValue,
  merge: merge,
  partition: partition,
  regexpEscape: regexpEscape
};

function asyncLog(argc, fmt) {
  var args;
  if (typeof argc === 'number') {
    args = Array.prototype.slice.call(arguments, 2);
    argc = Math.max(0, argc);
  } else {
    args = Array.prototype.slice.call(arguments, 1);
    fmt = '' + argc;
    argc = 0;
  }

  return function (next) {
    console.log.apply(console,
      [ fmt ].concat(args, Array.prototype.slice.call(arguments, 1, argc)));

    next.apply(null, [ null ].concat(Array.prototype.slice.call(arguments, 1)));
  };
};

function cleanIterable(iterable) {
  return Array.prototype.filter.call(iterable, function (v) {
    return v !== undefined;
  });
}

function cleanStack(stack) {
  return stack.split('\n').slice(1).map(function (s) {
    return s.trim();
  });
}

function deprecate(fn) {
  return function () {
    if (fn.name) console.warn("Function %s() is deprecated", fn.name);
    return fn.apply(this, arguments);
  };
}

function keyValue(set, obj, keys, valueOrDefault) {
  if (typeof (set) !== 'boolean') {
    valueOrDefault = keys;
    keys = obj;
    obj = set;
    set = false;
  }

  if (!Array.isArray(keys)) keys = [ keys ];

  var next = obj, key;

  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    if (next == null) break;
    if (set) {
      if (i === keys.length - 1) next[key] = valueOrDefault;
      else if (Object.hasOwnProperty.call(next, key)) {
        next = next[key];
      } else {
        next = next[key] = {};
      }
    } else {
      next = next[key];
    }
  }

  return set ? obj : ((next === undefined || i < keys.length) ? valueOrDefault : next);
}

var fnToString = (function(){}).toString;
/**
 *
 * based on jQuery.isPlainObject()
 * ( https://github.com/jquery/jquery/blob/master/src/core.js#L233 )
 */
function isPlainObject(obj) {
  var proto, Ctor;

  if (!obj || ({}).toString.call(obj) !== '[object Object]') {
    return false;
  }

  proto = Object.getPrototypeOf(obj);

  if (!proto) return true;

  Ctor = Object.hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor === 'function' && fnToString.call(Ctor) === fnToString.call(Object);
}

/**
 * merge([deep,] target, ...)
 *
 * Merge keys of objects into the first one.
 *
 * @param {boolean} [deep]
 *        If true, deep-copy properties of sources into target's properties.
 *        Also ensures that sources' properties are never moved into the target
 *        if they are objects or arrays, but deep-copied instead.
 *
 * @param {Object,Array} target
 *        Object to merge properties into.
 *
 * @param {Object,Array} ...
 *        Object to merge properties from.
 *
 * based on jQuery.extend()
 * ( https://github.com/jquery/jquery/blob/master/src/core.js#L126 )
 */
function merge() {
  var obj, key, src, copy, copyIsArray, clone,
      target = arguments[0],
      i = 1,
      length = arguments.length,
      deep = false;

  if (typeof target === 'boolean') {
    deep = target;
    target = arguments[i];
    i++;
  }

  if (i === length) return target; // only one argument, returns target

  if (!target) target = {};

  // Handle case when target is a string or something (possible in deep copy)
  if (typeof target !== 'object' && typeof target !== 'function') {
    target = {};
  }

  for (; i < length; i++) {
    obj = arguments[i];
    if (obj == null) continue;

    for ( key in obj ) {
      src = target[key];
      copy = obj[key];

      // cycle detected
      if (target === copy) continue;

      if (deep && copy && (isPlainObject(copy) || (copyIsArray = Array.isArray(copy)))) {
        if (copyIsArray) {
          copyIsArray = false;
          clone = src && Array.isArray(src) ? src : [];
        } else {
          clone = src && isPlainObject(src) ? src : {};
        }

        target[key] = merge(deep, clone, copy);
      } else if (copy !== undefined) {
        target[key] = copy;
      }
    }
  }

  return target;
}

function partition(string, sep) {
  var p = string.indexOf(sep);
  if (p < 0) return [ string, '', '' ];
  return [ string.substr(0, p), sep, string.substr(p + sep.length) ];
}

var _resc = /([$^\\.(|)\[\]{}*+?])/g;
function regexpEscape(string) {
  return string.replace(_resc, '\\$1');
}
