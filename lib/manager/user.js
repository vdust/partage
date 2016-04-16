/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var crypto = require('crypto');
var EventEmitter = require('events');
var util = require('util');

var crypt = require('crypt3');
var isemail = require('isemail');

var createError = require('../error').createError;

var Access = require('./access');


function User() {
  EventEmitter.call(this);
  User.prototype._create.apply(this, arguments);
}
util.inherits(User, EventEmitter);

var proto = User.prototype;

proto._create = function _create(nameOrRow) {
  var user = this;

  /* username[:password[:acl[:disabled[:email]]]] */
  var row = Array.isArray(nameOrRow) ? nameOrRow : nameOrRow.split(/ *: */);

  var passhash = row[1]||'';
  var level = Access.level(row[2]) || Access.LEVELS.visitor;
  var disabled = !!+row[3];
  var email = row[4] || '';

  User.checkName(row[0]);

  Object.definePropertie({
    name: {
      configurable: true,
      enumerable: true,
      writable: false,
      value: row[0]
    },
    password: {
      configurable: true,
      enumerable: false,
      get: function () { return passhash; },
      set: function (clear) {
        var salt = "$6$"+crypto.randomBytes(6).toString('base64');
        passhash = crypt(clear, salt);
      }
    },
    accessLevel: {
      configurable: true,
      enumerable: true,
      get: function () { return level; },
      set: function (l) {
        l = Access.level(l);
        if (l) {
          level = l;
        } else {
          throw createError(400, 'access.invalid', "Invalid access level");
        }
      }
    },
    disabled: {
      configurable: true,
      enumerable: true,
      writable: true,
      value: disabled
    },
    email: {
      configurable: true,
      enumerable: true,
      get: function () { return email; },
      set: function (e) {
        if (email === e) return;
        if (e && !isemail.validate(e)) return;
        email = e || '';
      }
    },
  });
};

proto.clone = function clone() {
  return new User([
    this.name,
    this.password,
    this.accessLevel,
    this.disabled,
    this.email
  ]);
};

proto.match = function match(u) {
  return this.name === u.name
      && this.password === u.password
      && this.accessLevel === u.accessLevel
      && this.disabled === u.disabled
      && this.email === u.email;
};

proto.setLevel = function setLevel(lvl, limit) {
  var l = Access.level(lvl);
  if (l && l < Access.level(limit||'special')) {
    this.accessLevel = l;
    return l;
  }
};

proto.passwordCheck = function passwordCheck(clearpass) {
  if (!this.password) return false;
  return crypt(clearpass, this.password) === this.password;
};

proto.csv = function csv() {
  return this.name+':'+this.password+':'+Access.name(this.accessLevel)+':'+(this.disabled?1:0)+':'+(this.email||'');
};

proto.is = function is(accessLevel) {
  accessLevel = Access.level(accessLevel);
  return accessLevel && this.accessLevel >= accessLevel;
};

proto.isProtected = function isProtected() {
  return this.accessLevel > Access.LEVELS.special;
};

proto.toJSON = function () {
  return {
    username: this.name,
    email: this.email,
    accessLevel: Access.name(this.accessLevel)
  };
};
proto.publicInfos = proto.toJSON; // XXX Deprecated

User.USERNAME_LENGTH = 3;
User.USERNAME_RE = /^[a-z][0-9a-z_-]{2,}$/i;
User.checkName = function checkName(name, errMerge) {
  var ctx = typeof this === 'string' ? this : '';

  if (!User.USERNAME_RE.test(name)) {
    var code, msg, extra;

    if (name && name.length < User.USERNAME_LENGTH) {
      code = 'length';
      msg = "User name is too short (minimum "+User.USERNAME_LENGTH+" characters)";
      extra = {
        minLength: User.USERNAME_LENGTH,
        got: name.length
      };
    } else {
      code = 'invalid';
      msg = "User name contains illegal characters";
      extra = {
        allowedFirst: '[A-Za-z]',
        allowed: '[0-9A-Za-z_-]'
      };
    }

    throw createError(400, ctx+'username.'+code, msg, utils.merge(extra, errMerge));
  }
};

var allowed = User.PASSWORD_ALLOWED = "[\\u0020-\\u005b\\u005d-\\u007e]";
var minlen = User.PASSWORD_MIN_LENGTH = 8;
User.PASSWORD_RE = new RegExp("^"+allowed+"{"+minlen+",}$");
User.checkPassword = function checkPassword(pwd, errMerge) {
  var ctx = typeof this === 'string' ? this : '';
  var code, msg, extra;

  if (typeof pwd !== 'string') {
    code = 'type';
    msg = "Password must be a string";
    extra = {
      expected: 'string',
      got: typeof pwd
    };
  } else if (!User.PASSWORD_RE.test(pwd)) {
    if (pwd.length < User.PASSWORD_MIN_LENGTH) {
      code = 'length';
      msg = "Password is too short (minimum "+User.PASSWORD_MIN_LENGTH+" characters)";
      extra = {
        minLength: User.PASSWORD_MIN_LENGTH,
        got: pwd.length
      };
    } else {
      code = 'invalid';
      msg = "Password conains illegal characters";
      extra = {
        allowed: User.PASSWORD_ALLOWED
      };
    }
  }

  if (code) throw createError(400, ctx+'password.'+code, msg, utils.merge(extra, errMerge));
};

User.checkEmail = function (email, errMerge) {
  var ctx = typeof this === 'string' ? this : '';

  if (email && !isemail.validate(email)) {
    throw createError(400, ctx+'email.invalid', "Invalid email", errMerge);
  }
  
  return r;
};

module.exports = User;
