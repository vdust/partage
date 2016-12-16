/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

var error = require('../../error');

var Access = require('../../manager/access');
var User = require('../../manager/user');

function accountsList(req, res) {
  var manager = this;
  var accounts = manager.listUsers();
  var result = {};
  var acl = (req.query.accessLevel||'').toLowerCase();
  var email = req.query.email;
  var cats, i, c, j, u;

  cats = Object.keys(accounts);

  for(i = 0; i < cats.length; i++) {
    c = cats[i];
    if (acl && c !== acl) continue;
    result[c] = [];
    for (j = 0; j < accounts[c].length; j++) {
      u = accounts[c][j];
      if (email && u.email !== email) continue;
      result[c].push(u.toJSON());
    }
  }

  res.status(200).send(result);
}

function accountCreate(req, res, next) {
  var manager = this;

  if (!this.userCanCreate(req.body.username)) {
    return next(error.conflict('account.exist', "User name already exists", {
      username: req.body.username
    }));
  }

  var u = new User(req.body.username);
  u.password = req.body.password;

  u.email = req.body.email||'';
  u.accessLevel = req.body.accessLevel;

  this.userUpdate(u, function (err) {
    if (err) return next(err);
    res.status(200).send(u.toJSON());
  });
}

function accountDelete(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username);
  var spe = req.user.is('special');

  // Assume success if user doesn't exist
  if (!u) return res.status(204).end();

  if (u.name === req.user.name) {
    return next(error.forbidden('account.delete.self', "Can't delete yourself", {
      username: req.params.username
    }));
  }

  if (u.is('special') && !spe) {
    return next(error.forbidden('account.delete.protected', "Can't delete account", {
      username: req.params.username
    }));
  }

  manager.userDelete(u, function (err) {
    if (err) return next(err);
    res.status(204).end();
  });
}

function accountGet(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');

  if (adm && !u) {
    return next(error.notFound('account.notfound', "Account not found", {
      username: req.params.username
    }));
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return next(error.forbidden('account.forbidden', "Can't query account informations", {
      username: req.params.username
    }));
  }

  res.status(200).send(u.toJSON());
}

function accountExist(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var found = (u && (adm || u.name === req.user.name));

  res.status(found ? 204 : 404).end();
}

function accountUpdate(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username, true);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');
  var update;

  if (adm && !u) {
    return next(error.notFound('user.notfound', "User not found", {
      username: req.params.username
    }));
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return next(error.forbidden('user.update.forbidden',
      "Can't update this user informations", {
        username: req.params.username
    }));
  }

  if ('password' in req.body) {
    update = true;
    u.password = req.body.password;
  }

  /* ignore accessLevel if not admin and not self. no error */
  if (adm && u.name !== req.user.name && 'accessLevel' in req.body) {
    update = true;
    u.accessLevel = req.body.accessLevel;
  }

  if ('email' in req.body) {
    update = true;
    u.email = req.body.email;
  }

  if (update) {
    manager.userUpdate(u, function (err) {
      if (err) return next(err);
      res.status(200).send(u.toJSON());
    });
  } else {
    res.status(200).send(u.toJSON());
  }
}

module.exports = function (manager) {
  return [
    { path: "/accounts",
      authAs: "admin",
      methods: {
        get: { doc: "Get accounts",
          query: {
            accessLevel: { doc: "only accounts with this access level",
              validate: Access.checkLevel, 'enum': Access.list() },
            email: { doc: "accounts with this email address",
              validate: User.checkEmail }
          },
          handle: accountsList.bind(manager)
        },
        post: { doc: "Create an account",
          body: {
            username: { doc: "User's name",
              required: true, validate: User.checkName },
            password: { doc: "User's password",
              required: true, validate: User.checkPassword },
            accessLevel: { doc: "User's default access level",
              validate: Access.checkLevel, 'enum': Access.list() },
            email: { doc: "User's email",
              validate: User.checkEmail }
          },
          handle: accountCreate.bind(manager)
        }
      }
    },
    { path: "/account/:username",
      authAs: "user",
      params: {
        username: { doc: "Account's name",
          validate: User.checkName }
      },
      methods: {
        'delete': { doc: "Delete an account",
          authAs: "admin",
          handle: accountDelete.bind(manager)
        },
        get: { doc: "Get account infos",
          handle: accountGet.bind(manager)
        },
        head: { doc: "Check if a account exists",
          handle: accountExist.bind(manager)
        },
        put: { doc: "Update existing account (missing fields are not updated)",
          body: {
            password: { doc: "User's password",
              validate: User.checkPassword },
            accessLevel: { doc: "User's default access level",
              authAs: "admin", // informative only here for api users. No auto-check
              validate: Access.checkLevel, 'enum': Access.list() },
            email: { doc: "User's email",
              validate: User.checkEmail }
          },
          handle: accountUpdate.bind(manager)
        }
      }
    }
  ];
};
