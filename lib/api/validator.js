/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var validateProperties = require('../validator').properties;
var error = require('../error');

/**
 * Returns a middleware that checks req.body properties against fields
 * definitions.
 * Also ensures that has been parsed from a json payload.
 */
function bodyValidator(definitions) {
  var validator = dataValidator('body', definitions);

  return function (req, res, next) {
    var ctype = req.headers['content-type'];
    var clen = +req.headers['content-length'];
    var err;

    if (!ctype && !clen) {
      req.body = {};
      return next();
    }

    // ensure request body has the correct type
    if (!req.is('application/json')) {
      err = error.createError(400, 'body.type',
        ctype ? "Content-Type not supported" : "Missing Content-Type",
        {
          expect: 'application/json',
          got: ctype ? ctype.split(/ *; */)[0] : undefined
        });
    }

    if (typeof req.body !== 'object') {
      err = error.createError(400, 'body.json.type', "INvalid request data", {
        expect: 'object',
        got: typeof req.body
      });
    }

    if (err) return next(err);

    validator(req, res, next);
  };
}

/**
 * Returns a middleware that checks req[ctx] properties against fields
 * definitions.
 *
 * @param ctx
 *        Any of 'body', 'params' or 'query'. (or other objects if relevant)
 * @param definitions
 *        Properties definitions (see filehub.validator.properties())
 */
function dataValidator(ctx, definitions) {
  return function (req, res, next) {
    try {
      validateProperties.call(ctx+'.', req[ctx], definitions);
    } catch (e) {
      return next(e);
    }

    process.nextTick(next);
  }
}

module.exports = {
  body: bodyValidator,
  data: dataValidator
};
