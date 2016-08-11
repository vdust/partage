/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

var EventEmitter = require('events');
var resolve = require('path').resolve;
var util = require('util');

var fs = require('fs-extra');

var merge = require('.').merge;

function DevWatch() {
  EventEmitter.call(this);
  DevWatch.prototype._init.apply(this, arguments);
}
util.inherits(DevWatch, EventEmitter);

module.exports = DevWatch;

var proto = DevWatch.prototype;

proto._init = function _init(path, options) {
  if (typeof path !== 'string') {
    throw new TypeError("path must be a string");
  }

  var opts = this.options = {
    filter: /\.js$/,
    firstUpdate: null // (list)=>{}
  };
  var tOpts = typeof options

  if (tOpts === 'string' || options instanceof RegExp) {
    opts.filter = options;
  } else if (tOpts === 'function') {
    opts.firstUpdate = options
  } else if (tOpts === 'object') {
    merge(opts, options);
  }

  if (typeof opts.filter === 'string') {
    opts.filter = new RegExp(opts.filter);
  } else if (!(opts.filter instanceof RegExp)) {
    console.warn("Unexpected DevWatch filter: fallback to catchall filter");
    opts.filter = { test: () => true };
  }

  this.path = resolve(path);
  this._list = [];

  this._watcher = fs.watch(this.path, {
    persistent: false // won't prevent the application to exit if only this watcher remains.
  }, (eventType) => {
    if (this._pending || eventType !== 'rename') return;
    this._pending = true;

    // Only one scan will be done after all pending events are triggered.
    setImmediate(() => {
      delete this._pending;
      this._scan();
    });
  });

  if (typeof opts.firstUpdate === 'function') {
    this.once('update', opts.firstUpdate);
    delete opts.firstUpdate;
  }
  this._scan(); // Run first scan immediately.
};

proto._scan = function _scan() {
  if (this._scanning) {
    // ongoing scan: queue for rescan once the current one is completed.
    this._queued = true;
    return;
  }

  // Expire cached list
  this._uptodate = false;

  this._scanning = true;
  fs.readdir(this.path, (err, files) => {
    if (err) {
      console.error("Failed to update devscripts at %s: %s", this.path, err.toString());
    }

    delete this._scanning;

    if (this._queued) {
      // Rescan immediately since the current one might be outdated.
      // We ignore errors in this case since it might be resolved in next scan
      // or will be triggered again otherwise.
      delete this._queued;
      return this._scan();
    }

    this._list = [];
    this._uptodate = true;

    if (err) {
      this.emit('error', err);
      return;
    }

    for (var i = 0; i < files.length; i++) {
      if (this.options.filter.test(files[i])) {
        this._list.push(files[i]);
      }
    }

    this._list.sort();

    // notify a copy of the list to prevent unexpected alterations of the
    // cache.
    this.emit('update', merge([], this._list));
  });
};

proto.close = function stop() {
  this._watcher.close();
  // Preserve last known state.
};

proto.getList = function (callback) {
  this.once('update', callback);

  if (this._uptodate) {
    // Give a chance to possible watcher events to be handled.
    setImmediate(() => {
      if (!this.pending && this._uptodate) {
        this.emit('update', merge([], this._list));
      }
    });
  } // otherwise, pending scan will call event listener in time.
};
