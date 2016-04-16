/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var EventEmitter = require('events');
var fs = require('fs-extra');
var resolve = require('path').resolve;
var basename = require('path').basename;
var util = require('util');

var async = require('async');

var utils = require('../utils');

var ctlInit = require('./ctl');
var Resource = require('./resource');

function Special() {
  EventEmitter.call(this);
  Special.prototype._create.apply(this, arguments);
}
util.inherits(Special, EventEmitter);


// Exports
module.exports = Special;


var proto = Special.prototype;

proto._create = function _create(manager, path, options) {
  Object.defineProperties({
    manager: { value: manager },
    options: {
      enumerable: true,
      value: utils.merge({
        clean: true,
        cleanInterval: 60, // in minutes
        maxAge: 1 // in hours
      }, options || {})
    },
    abspath: {
      enumerable: true,
      value: resolve(manager.root, path)
    },
    name: {
      enumerable: true,
      value: basename(path)
    }
  });
  
  ctlInit(this, true);
};

proto.init = function init(callback) {
  var special = this;

  var done = this._ctlSharedAction({
    eventName: 'init',
    once: true
  }, callback);

  if (!done) return;

  fs.ensureDir(this.abspath, function (err) {
    if (!err) special.cleanerStart();
    done(err);
  });
};

proto.cleanerStart = function cleanerStart() {
  if (this._cleanerTm) return;

  var cci = (this.options.cleanInterval);
  cci = 60000 * (cci > 0 ? cci : 60);
  this._cleanerTm = setInterval(this.cleanerCheck.bind(this), cci);
};

proto.cleanerStop = function cleanerStop() {
  if (!this._cleanerTm) return;
  clearInterval(this._cleanerTm);
  delete this._cleanerTm;
};

proto.cleanerCheck = function cleanerCheck() {
  var special = this;

  var done = this._ctlSharedAction('clean');

  if (!done) return; // prevent overlapping operations

  var maxAge = (this.options.maxAge || 1) * 3600000;
  var then = (new Date()).getTime() - maxAge;

  fs.readdir(this.abspath, function (err, files) {
    if (err) return done(err);

    async.eachLimit(files, Resource.asyncLimit, function cleanResource(f, next) {
      f = resolve(special.abspath, f);
      fs.stat(f, function (err, stats) {
        if (!err && stats.ctime.getTime() < then) {
          return fs.remove(f, next);
        }
        next((err && err.code !== 'ENOENT') ? err : null);
      });
    }, done);
  });
};
