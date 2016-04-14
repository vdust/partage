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
  /* username[:password[:acl[:disabled[:email]]]] */
  var row = nameOrRow.split(/ *: */);

  this.name = row[0];
  this.passhash = row[1];
  this.setLevel(row[2]);
  this.disabled = !!+row[3];
  this.email = row[4]||'';
};

proto.setLevel = function setLevel(lvl) {
  /* silently fallback to visitor here */
  this.accessLevel = Access.level(lvl) || Access.LEVELS.visitor;
  return this.accessLevel;
};

proto.passwordSet = function passwordSet(clearpass) {
  var salt = "$6$"+crypto.randomBytes(6).toString('base64');
  this.passhash = crypt(clearpass, salt);
};

proto.passwordCheck = function passwordCheck(clearpass) {
  if (!this.passhash) return false;
  return crypt(clearpass, this.passhash) === this.passhash;
};

proto.csv = function csv() {
  return this.name+':'+this.passhash+':'+Access.name(this.accessLevel)+':'+(this.protect?1:0)+':'+(this.email||'');
};

proto.is = function is(accessLevel) {
  accessLevel = Access.level(accessLevel);
  return accessLevel && this.accessLevel >= accessLevel;
};

proto.isProtected = function isProtected() {
  return this.accessLevel > Access.LEVELS.special;
};

proto.publicInfos = function () {
  return {
    username: this.name,
    email: this.email,
    accessLevel: Access.name(this.accessLevel)
  };
};

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
