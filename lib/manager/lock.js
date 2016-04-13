/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

function AsyncLock(onFullRelease) {
  var readers = 0;
  var queue = [];

  var checkRelease = function () {};
  if (typeof onFullRelease === 'function') {
    checkRelease = function () {
      if (!readers && !queue.length) {
        onFullRelease();
      }
    }
  }

  this.acquire = function acquire(excl, callback, timeout) {
    if (excl === 'function') {
      timeout = callback;
      callback = excl;
      excl = false;
    }

    var release = (function () {
      var released = false;
      return function release() {
        if (released) return;
        released = true;
        if (excl) readers = 0; else readers--;
        checkRelease();
        process.nextTick(function () {
          if (queue.length) queue[0]();
        });
      };
    })();

    if (((excl && readers) || readers < 0) || queue.length) {
      var pending;

      queue.push(function () {
        if (pending && (!readers || (!excl && readers >= 0))) {
          if (pending !== true) clearTimeout(pending);
          pending = false;
          queue.shift();
          if (excl) readers = -1; else readers++;
          callback(null, release);
        }
      });

      if (timeout > 0) {
        pending = setTimeout(function () {
          if (pending) {
            pending = false;
            queue.shift();
            var e = new Error("Lock.acquire timed out");
            e.code = 'ETIMEOUT';
            callback(e);
          }
        }, timeout);
      } else pending = true;
    } else {
      if (excl) readers = -1; else readers++;
      process.nextTick(callback, null, release);
    }
  };
}


function Locker() {
  if (!(this instanceof Locker)) return new Locker();

  this.locks = {};
  this.defaultLock = new Locker.AsyncLock();

}
Locker.AsyncLock = AsyncLock;

module.exports = Locker;

Locker.prototype.acquire = function acquire(named, excl, callback, timeout) {
  var manager = this;
  var lock;

  if (typeof named !== 'string') {
    timeout = callback;
    callback = excl;
    excl = named;
    lock = this.defaultLock;
  } else {
    if (!(named in this.locks)) {
      this.locks[named] = new AsyncLock(function () {
        delete manager.locks[named];
      });
    }
    lock = this.locks[named];
  }

  if (typeof excl === 'function') {
    timeout = callback;
    callback = excl;
    excl = false;
  }

  if (typeof callback !== 'function') {
    throw new Error("Callback must be a function");
  }

  lock.acquire(excl, callback, timeout);
};
