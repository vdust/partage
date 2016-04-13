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

var utils = require('../utils');

function Special() {
  EventEmitter.call(this);
  Special.prototype._create.apply(this, arguments);
}
util.inherits(Special, EventEmitter);


// Exports
module.exports = Special;


var proto = Special.prototype;

proto._create = function _create(manager, path, options) {
  this._manager = manager;

  this.options = utils.merge({
    clean: true,
    cleanInterval: 60, // in minutes
    maxAge: 1 // in hours
  }, options || {});
  
  this.path = resolve(manager.root, path);
  this.name = basename(path);
};

proto.setup = function setup(cb) {
  var spe = this;

  if (this._isSetup) return;

  fs.ensureDir(this.path, function (err) {
    if (err) return cb(err);
    spe._isSetup = true;
    spe.cleanerStart();
    cb();
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
  var spe = this;

  if (this._cleaning) return; // prevent overlapping cleaning operations

  var maxAge = (this.options.maxAge || 1) * 3600000;
  var then = (new Date()).getTime() - maxAge;

  this._cleaning = true;

  fs.readdir(this.path, function (err, files) {
    _next(err);

    function _next(err) {
      var f;

      if (err || !(f = files.pop())) {
        delete spe._cleaning;
        if (err) spe.emit('cleanerror', err);
        return;
      }

      f = resolve(spe.path, f);

      fs.stat(f, function (err, stats) {
        if (!err && stats.ctime.getTime() < then) {
          return fs.remove(f, _next);
        }
        _next(err);
      });
    }
  });
};
