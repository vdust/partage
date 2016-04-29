/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var validateProperties = require('../validator').properties;

/**
 * Returns a middleware that checks req.body properties against fields
 * definitions.
 * Also ensures that has been parsed from a json payload.
 */
function bodyValidator(definitions) {
  var validator = dataValidator('body', definitions);

  return function (req, res, next) {
    // ensure request body has the correct type
    if (!req.is('application/json')) {
      var ctype = req.headers['content-type'];
      return res.status(400).send({
        error: ctype ? "Content-Type not supported" : "Missing Content-Type",
        details: {
          code: "body.type",
          expect: "application/json",
          got: ctype ? ctype.split(/ *; */)[0] : undefined
        }
      });
    }

    if (typeof req.body !== 'object') {
      return res.status(400).send({
        error: "Invalid request data",
        details: {
          code: "body.json.type",
          expect: "object",
          got: typeof req.body
        }
      });
    }

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
      return res.status(400).send({
        error: e.message ? e.message : ''+e,
        details: e.details || {
          code: ctx||'unknown'
        },
        stack: e.stack.split('\n')
      });
    }

    process.nextTick(next);
  }
}

module.exports = {
  body: bodyValidator,
  data: dataValidator
};
