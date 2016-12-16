/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

var locker = require('./lock');

module.exports = function ctlInit(obj, lock) {
  Object.defineProperties(obj, {
    _ctl: { value: {} },
    _ctlClean: {
      value: function _ctlClean() {
        for (var i = 0; i < arguments.length; i++) {
          delete obj._ctl[arguments[i]];
        }
      }
    },
    _ctlFlag: {
      value: function _ctlFlag() {
        for (var i = 0; i < arguments.length; i++) {
          obj._ctl[arguments[i]] = true;
        }
      }
    },
    _ctlSharedAction: {
      value: function _ctlSharedAction(options, callback) {
        var evt, ctlKey, once, pending, cond, onDone;

        if (typeof options === 'string') {
          options = { eventName: options };
        }
        evt = options.eventName;
        if (!evt) throw new Error("eventName required");

        ctlKey = options.ctlKey || ('_' + evt);

        once = options.once === true ? 'is_'+evt : options.once;
        pending = options.pending;

        if (once && pending) {
          throw new Error("once and pending are mutually exclusive");
        }

        if (typeof pending === 'function') {
          pending = { trigger: pending, key: ctlKey+'__pending' };
        } else if (pending && typeof pending.trigger !== 'function') {
          throw new Error("Missing trigger function for pending shared action");
        } else if (pending && !pending.key) {
          pending.key = ctlKey+'__pending';
        }

        cond = options.cond;
        onDone = options.done;

        if (typeof callback === 'function') {
          if (pending) {
            obj.once(evt+'_schedule', function () {
              obj.once(evt, callback);
            });
          } else {
            obj.once(evt, callback);
          }
        }

        if (pending && obj._ctl[pending.key]) return;

        if (once && obj._ctl[once]) {
          process.nextTick(obj.emit.bind(obj), evt, obj._ctl[once+'_Error']);
          return;
        }

        if (obj._ctl[ctlKey]) {
          if (pending) {
            obj._ctl[pending.key] = true;
            obj.once(evt, function () {
              obj._ctlClean(pending.key);
              pending.trigger();
            });
          }
          return;
        }

        obj._ctl[options.ctlKey] = true;

        if (pending) obj.emit(evt+'_schedule');

        return function done(err) {
          if (Array.isArray(cond)) {
            if (err || (pending && obj._ctl[pending.key])) {
              obj._ctlClean(cond);
            } else {
              obj._ctlFlag(cond);
            }
          }

          obj._ctlClean(ctlKey);

          if (once) {
            obj._ctl[once] = true;
            if (err) obj._ctl[once+'_Error'] = err;
          }

          if (typeof onDone === 'function') {
            onDone.apply(null, arguments);
          }

          obj.emit.bind(obj, options.eventName).apply(obj, arguments);
        };
      }
    }
  });

  if (lock) {
    Object.defineProperty(obj, '_lock', { value: locker() });

    obj.lock = function lock(ctx, excl, callback, timeout) {
      return this._lock.acquire(ctx, excl, callback, timeout);
    };
  }
};
