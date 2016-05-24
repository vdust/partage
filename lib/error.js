/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var util = require('util');

var merge = require('./utils').merge;
var cleanStack = require('./utils').cleanStack;

function LibError(statusCode, errorCode, message, extra, stackOpt) {
  Error.call(this);

  Object.defineProperties(this, {
    name: {
      enumerable: false,
      writable: false,
      value: LibError.name
    },
    message: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: message
    },
    statusCode: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: statusCode
    },
    _sendStack: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: false
    }
  });

  Error.captureStackTrace(this, stackOpt || LibError);

  this.code = errorCode;

  if (extra) merge(this, extra);
}
util.inherits(LibError, Error);

LibError.prototype.sendStack = function (enable) {
  this._sendStack = typeof enable === 'boolean' ? enable : true;
  return this;
};

LibError.prototype.toJSON = function () {
  var data = { error: this.message };
  if (process.env.NODE_ENV !== 'production' && this._sendStack) {
    data.stack = this.stack ? cleanStack(this.stack) : undefined;
  }
  return merge(data, this);
};



// LibError handler
exports = module.exports = function errorHandler(err, req, res, next) {
  if (!err) return next(); // should never happen

  if (res.headersSent || !(err instanceof LibError)) {
    // Delegate to default error handler
    return next(err);
  }

  if (res.sendStack) err.sendStack();

  res.status(err.statusCode || 500).send(err);
};


exports.LibError = LibError;

exports.createError = function createError(statusCode, errorCode, message, extra, stackOpt) {
  if (!stackOpt) stackOpt = exports.createError;
  return new LibError(statusCode, errorCode, message, extra, stackOpt);
};

exports.isLibError = function (err) {
  return err instanceof LibError;
};

exports.sendError = function sendError(res, statusCode, errorCode, message, extra) {
  var e;

  if (statusCode instanceof LibError) {
    e = statusCode;
  } else {
    e = exports.createError(statusCode, errorCode, message, extra, exports.sendError);
  }

  res.status(e.statusCode || 500).send(e);
};

exports.forbidden = function forbidden(errorCode, message, extra) {
  if (typeof message !== 'string') {
    var t = typeof errorCode === 'string';
    extra = t ? message : errorCode;
    message = t ? errorCode : "Forbidden";
    errorCode = 'forbidden';
  }

  return exports.createError(403, errorCode, message, extra, exports.forbidden);
};

exports.notFound = function notFound(errorCode, message, extra) {
  if (typeof message !== 'string') {
    var t = typeof errorCode === 'string';
    extra = t ? message : errorCode;
    message = t ? errorCode : "Not Found";
    errorCode = 'notfound';
  }

  return exports.createError(404, errorCode, message, extra, exports.notFound);
};

exports.conflict = function conflict(errorCode, message, extra) {
  if (typeof message !== 'string') {
    var t = typeof errorCode === 'string';
    extra = t ? message : errorCode;
    message = t ? errorCode : "Conflict";
    errorCode = 'conflict';
  }

  return exports.createError(409, errorCode, message, extra, exports.conflict);
};

exports.unexpected = function unexpected(errorCode, message, extra) {
  if (typeof message !== 'string') {
    var t = typeof errorCode === 'string';
    extra = t ? message : errorCode;
    message = t ? errorCode : "Unexpected Error";
    errorCode = 'unexpected';
  }

  return exports.createError(500, errorCode, message, extra, exports.unexpected);
};

exports.notImplemented = function notImplemented(errorCode, message, extra) {
  if (typeof message !== 'string') {
    var t = typeof errorCode === 'string';
    extra = t ? message : errorCode;
    message = t ? errorCode : "Not Implemented";
    errorCode = 'notimplemented';
  }

  return exports.createError(501, errorCode, message, extra, exports.notImplemented);
};
