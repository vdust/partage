/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var Access = require('../../manager/access');
var User = require('../../manager/user');

function _saveUsers(res, u, onerr) {
  var manager = this;

  manager.saveUsers(true, function (err) {
    if (err) {
      if (typeof onerr === 'function') {
        onerr();
      }
      return res.status(500).send({
        error: "Failed to persist new user informations",
        details: {
          code: 'user.create.save'
        }
      });
    }
    if (u) {
      res.status(200).send(u.publicInfos());
    } else {
      res.status(204).end();
    }
  });
}

function usersList(req, res) {
  var manager = this;
  var users = manager.listUsers();
  var result = {};
  var acl = (req.query.accessLevel||'').toLowerCase();
  var email = req.query.email;
  var cats, i, c, j, u;

  cats = Object.keys(users);

  for(i = 0; i < cats.length; i++) {
    c = cats[i];
    if (acl && c !== acl) continue;
    result[c] = [];
    for (j = 0; j < users[c].length; j++) {
      u = users[c][j];
      if (email && u.email !== email) continue;
      result[c].push(u.publicInfos());
    }
  }

  res.status(200).send(result);
}

function userCreate(req, res) {
  var manager = this;
  var u = manager.user(req.body.username);

  if (u) {
    return res.status(409).send({
      error: "User name already exists",
      details: {
        code: 'user.create.exist',
        username: req.body.username
      }
    });
  }

  u = manager.user(req.body.username, true);
  u.email = req.body.email||'';
  u.setLevel(req.body.accessLevel);
  u.passwordSet(req.body.password);

  _saveUsers.call(manager, res, u, function () {
    manager.userDelete(u);
  });
}

function userDelete(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var spe = req.user.is('special');
  /* admin ensured at this point */

  /* Assume success if user doesn't exist
   * (make delete idempotent)
   */
  if (!u) return res.status(204).end();

  if (u.name === req.user.name) {
    return res.status(403).send({
      error: "Can't delete yourself",
      details: {
        code: 'user.delete.self',
        username: req.params.username
      }
    });
  }

  if (u.is('special') && !spe) {
    return res.status(403).send({
      error: "Can't delete user",
      details: {
        code: 'user.delete.forbidden',
        username: req.params.username
      }
    });
  }

  manager.userDelete(u);

  _saveUsers(manager, res);
}

function userGet(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');

  if (adm && !u) {
    return res.status(404).send({
      error: "User not found",
      details: {
        code: 'user.notfound',
        username: req.params.username
      }
    });
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return res.status(403).send({
      error: "Can't query user informations",
      details: {
        code: 'user.get.forbidden',
        username: req.params.username
      }
    });
  }

  res.status(200).send(u.publicInfos());
}

function userExist(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var found = (u && (adm || u.name === req.user.name));

  res.status(found ? 204 : 404).end();
}

function userUpdate(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');
  var rev = {}, update;

  if (adm && !u) {
    return res.status(404).send({
      error: "User not found",
      details: {
        code: 'user.notfound',
        username: req.params.username
      }
    });
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return res.status(403).send({
      error: "Can't udate this user informations",
      details: {
        code: 'user.update.forbidden',
        username: req.params.username
      }
    });
  }

  if ('password' in req.body) {
    update = true;
    rev.passhash = u.passhash;
    u.passwordSet(req.body.password);
  }

  /* ignore accessLevel if not admin. no error */
  if (adm && 'accessLevel' in req.body) {
    update = true;
    rev.accessLevel = u.accessLevel;
    u.setLevel(req.body.accessLevel);
  }

  if ('email' in req.body) {
    update = true;
    rev.email = u.email;
    u.email = req.body.email;
  }

  if (update) {
    _saveUsers.call(manager, res, u, function () {
      /* reverse infos to before the state before the update started */
      Object.keys(rev).forEach(function (k) {
        u[k] = rev[k];
      });
    });
  } else {
    res.status(200).send(u.publicInfos());
  }
}

module.exports = function (manager) {
  return [
    { path: "/users",
      authAs: "admin",
      methods: {
        get: { doc: "Get users",
          query: {
            accessLevel: { doc: "only users with this access level",
              validate: Access.checkLevel, 'enum': Access.list() },
            email: { doc: "users with this email address",
              validate: User.checkEmail }
          },
          handle: usersList.bind(manager)
        },
        post: { doc: "Create a user",
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
          handle: userCreate.bind(manager)
        }
      }
    },
    { path: "/user/:username",
      authAs: "visitor",
      params: {
        username: { doc: "User's name",
          validate: User.checkName }
      },
      methods: {
        'delete': { doc: "Delete a user",
          authAs: "admin",
          handle: userDelete.bind(manager)
        },
        get: { doc: "Get user infos",
          handle: userGet.bind(manager)
        },
        head: { doc: "Check if a user exists",
          handle: userExist.bind(manager)
        },
        put: { doc: "Update existing user (missing fields are not updated)",
          body: {
            password: { doc: "User's password",
              validate: User.checkPassword },
            accessLevel: { doc: "User's default access level",
              authAs: "admin", validate: User.checkLevel, 'enum': Access.list() },
            email: { doc: "User's email",
              validate: User.checkEmail }
          },
          handle: userUpdate.bind(manager)
        }
      }
    },
  ];
};
