/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

// core deps
var crypto = require('crypto');
var EventEmitter = require('events');
var util = require('util');

// extern deps
var crypt = require('crypt3');
var isemail = require('isemail');

// local deps
var Access = require('./access');
var error = require('../utils').error;

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
User.checkName = function checkName(name, exc) {
  var r = User.USERNAME_RE.test(name), e;
  exc = arguments.length === 1 ? true : exc;
  if (!r && exc) {
    if (name && name.length < User.USERNAME_LENGTH) {
      e = error("User name is too short (minimum: "+User.USERNAME_LENGTH+")", {
        code: 'length',
        minLength: User.USERNAME_LENGTH,
        got: name.length
      });
    } else {
      e = error("User name contains illegal characters", {
        code: 'illegal',
        allowedFirst: '[A-Za-z]',
        allowed: '[0-9A-Za-z_-]'
      });
    }
    throw e;
  }
  return r;
};

var allowed = User.PASSWORD_ALLOWED = "[\\u0020-\\u005b\\u005d-\\u007e]";
var minlen = User.PASSWORD_MIN_LENGTH = 8;
User.PASSWORD_RE = new RegExp("^"+allowed+"{"+minlen+",}$");
User.checkPassword = function checkPassword(pwd, exc) {

  var t = typeof pwd === 'string';
  var r = (t && User.PASSWORD_RE.test(pwd));
  var e;

  exc = arguments.length === 1 ? true : exc;

  if (!r && exc) {
    if (pwd && pwd.length < User.PASSWORD_MIN_LENGTH) {
      e = error("Password is too short (minimum: "+User.PASSWORD_MIN_LENGTH+")", {
        code: 'length',
        minLength: User.PASSWORD_MIN_LENGTH,
        got: pwd.length
      });
    } else {
      e = error("Password contains illegal characters", {
        code: 'illegal',
        allowed: User.PASSWORD_ALLOWED
      });
    }
    throw e;
  }

  return r;
};

User.checkEmail = function (email, exc) {
  var r;

  if (!email) return true; /* we allow empty email */

  if (arguments.length < 2) exc = true;

  r = isemail.validate(email);

  if (!r && exc) {
    throw error("Invalid email", {
      code: 'illegal',
      expect: 'email'
    });
  }
  
  return r;
};

module.exports = User;
