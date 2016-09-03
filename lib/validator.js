/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var createError = require('./error.js').createError;

module.exports = {
  type: validateType,
  properties: validateProperties
};


function validateType(v, expect, errMerge) {
  var ctx = 'string' === typeof this ? this : '';
  var type = typeof expect === 'string' ? expect : expect.type;
  var split = (expect !== type) && expect.split;

  function _err(msg, extra) {
    var infos = {
      expect: type,
      got: typeof v
    };
    if (type === 'array' && split) infos.split = split;
    merge(infos, extra, errMerge);
    return createError(400, ctx+'type.invalid', msg, infos, _err);
  };

  switch (type) {
    case 'number':
      v = +v;
      if (isNaN(v)) throw _err("Not a number");
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
        } else if (split) {
          v = v.trim().split(new RegExp("\\s*"+split+"\\s*"));
        } else {
          v = [ v ];
        }
      } else if (!Array.isArray(v)) {
        throw _err("Array expected, got " + typeof v);
      }
    case 'glob':
      try {
        v = require('minimatch').makeRe(v);
      } catch (e) {
        throw _err(e.message || (''+e));
      }
      break;
    case 'regexp':
      if (v instanceof RegExp) break;

      if (typeof v !== 'string') {
        throw _err("Expected regular expression (string), got " + typeof v);
      }

      try {
        v = new RegExp(v);
      } catch (e) {
        throw _err("Invalid refular expression");
      }
      break;
    default:
      break;
  }

  return v;
}

/**
 * ValidateProperties(obj, definitions)
 *
 * Validate properties of an object against definitions
 *
 * Throws an error object if any property doesn't validate.
 *
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
function validateProperties(obj, definitions) {
  var ctx = typeof this === 'string' ? this : '';

  obj = obj || {};

  Object.keys(definitions).forEach(function (key) {
    var def = definitions[key];

    if (key in obj) {
      if (typeof def.type === 'string') {
        obj[key] = validateType.call(ctx+'property.', obj[key], def, { key: key });
      }

      if (typeof def.validate === 'function') {
        try {
          def.validate.call(ctx+'property.', obj[key]);
        } catch (e) {
          e.key = key;
          throw e;
        }
      } else if (def.validate) {
        console.warn("validator for property '%s' is not a function ", ctx+key);
      }
    } else if (def.required) {
      throw createError(400, ctx+'property.required', "Property '"+key+"' required", {
        key: key
      });
    }
  });
}
