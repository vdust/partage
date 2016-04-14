/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Roussea
 * MIT Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs');
var resolve = require('path').resolve;
var util = require('util');
var zlib = require('zlib');

var conf = require('../config');
var createError = require('../error').createError;
var utils = require('../utils');

var Special = require('./special');
var Resource = require('./resource');

function Uploads() {
  Special.apply(this, arguments);
}
util.inherits(Uploads, Special);


// Exports
module.exports = Uploads;


var proto = Uploads.prototype;

proto.save = function save(req, callback) {
  var outStream, inStream;
  var tmpFile;

  var complete = false;
  var sync = true;
  var received = 0;
  var limit = this.options.sizeLimit || null;
  var length;

  do {
    tmpFile = resolve(this.abspath, Uploads.tmpName());

    try {
      outStream = fs.createWriteStream(tmpFile, { flags: 'wx' });
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.log(e);
        return done(Resource.createError(e));
      }
    }
  } while (!outStream);

  inStream = Uploads.contentStream(req);
  length = inStream.length || null;
  console.log(length);

  inStream.on('aborted', onAborted);
  inStream.on('close', cleanup);
  inStream.on('data', onData);
  inStream.on('error', onEnd);
  // Don't track inStream's 'end' because we rely on outStream's auto-close

  outStream.on('error', onEnd);
  outStream.on('finish', onEnd);

  sync = false;

  inStream.pipe(outStream);

  function done(err) {
    complete = true;

    if (sync) {
      process.nextTick(fini);
    } else {
      fini();
    }

    function fini() {
      cleanup();

      if (err) {
        inStream.unpipe();

        if (typeof inStream.pause === 'function') {
          inStream.pause();
        }

        tmpFile = undefined;
      }

      callback(err, tmpFile);
    }
  }

  function onAborted() {
    if (complete) return;

    done(createError(400, 'request.aborted', "Request aborted"));
  }

  function onData(chunk) {
    if (complete) return;

    received += chunk.length;
    if (limit !== null && received > limit) {
      done(createError(413, 'entity.too.large', "Request entity too large", {
        limit: limit,
        received: received
      }));
    }
  }

  function onEnd(err) {
    if (complete) return;
    if (err) return done(err);

    if (length !== null && received !== length) {
      done(createError(400, 'request.size.invalid',
        "Request size did not match content length", {
          expected: length,
          received: received
      }));
    } else {
      done();
    }
  }

  function cleanup() {
    if (outStream) {
      outStream.removeListener('error', onEnd);
      if (!outStream.closed) outStream.end();
    }

    if (inStream) {
      inStream.removeListener('aborted', onAborted);
      inStream.removeListener('data', onData);
      inStream.removeListener('end', onEnd);
      inStream.removeListener('error', onEnd);
      inStream.removeListener('close', cleanup);
    }
  }
};


Uploads.checkStream = function checkStream(req) {
  var encoding = (req.headers['content-encoding'] || 'identity').toLowerCase();

  switch (encoding) {
    case 'deflate':
    case 'gzip':
    case 'identity':
      break;
    default:
      throw utils.error(4015, "Unsupported content encoding '" + encoding + "'", {
        code: 'file.encoding',
        encoding: encoding,
        accept: [ 'deflate', 'gzip', 'identity' ]
      });
  }

  return encoding;
};

Uploads.contentStream = function contentStream(req) {
  var encoding = Uploads.checkStream(req);
  var length = +req.headers['content-length']||null;
  var stream;

  switch (encoding) {
    case 'deflate':
      stream = zlib.createInflate();
      break;
    case 'gzip':
      stream = zlib.createGunzip();
      break;
    default:
      break;
  }

  if (stream) {
    req.pipe(stream);
  } else {
    stream = req;
    stream.length = length;
  }

  return stream;
};

Uploads.tmpName = function () {
  var rand = Math.random().toString(36).substr(2);
  return '_' + rand + '.' + (new Date()).getTime().toString(36);
};

