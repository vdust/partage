/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var error = require('../../error');

var Access = require('../../manager/access');
var User = require('../../manager/user');

function _saveUsers(res, u, next) {
  this.saveUsers(true, function (err) {
    if (err) return next(err);
    if (u) {
      res.status(200).send(u.toJSON());
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
      result[c].push(u.toJSON());
    }
  }

  res.status(200).send(result);
}

function userCreate(req, res, next) {
  var manager = this;

  if (!this.userCanCreate(username)) {
    return next(error.conflict('user.exist', "User name already exists", {
      username: req.body.username
    }));
  }

  var u = new User(req.body.username);

  u.email = req.body.email||'';
  u.accessLevel = req.body.accessLevel;
  u.password = req.body.password;

  this.userUpdate(u, function (err) {
    if (err) return next(err);
    res.status(200).send(u.toJSON());
  });
}

function userDelete(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username);
  var spe = req.user.is('special');

  // Assume success if user doesn't exist
  if (!u) return res.status(204).end();

  if (u.name === req.user.name) {
    return next(error.forbidden('user.delete.self', "Can't delete yourself", {
      username: req.params.username
    }));
  }

  if (u.is('special') && !spe) {
    return next(error.forbidden('user.delete.forbidden', "Can't delete user", {
      username: req.params.username
    }));
  }

  manager.userDelete(u, function (err) {
    if (err) return next(err);
    res.status(204).end();
  });
}

function userGet(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');

  if (adm && !u) {
    return next(error.createError('user.notfound', "User not found", {
      username: req.params.username
    });
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return next(error.createError('user.forbidden', "Can't query user informations", {
      username: req.params.username
    });
  }

  res.status(200).send(u.toJSON());
}

function userExist(req, res) {
  var manager = this;
  var u = manager.user(req.params.username);
  var adm = req.user.is('admin');
  var found = (u && (adm || u.name === req.user.name));

  res.status(found ? 204 : 404).end();
}

function userUpdate(req, res, next) {
  var manager = this;
  var u = manager.user(req.params.username, true);
  var adm = req.user.is('admin');
  var spe = req.user.is('special');
  var update;

  if (adm && !u) {
    return next(error.notFound('user.notfound', "User not found", {
      username: req.params.username
    });
  }

  if (!u || (u.is('special') && !spe) || (u.name !== req.user.name && !adm)) {
    return next(error.forbidden('user.update.forbidden',
      "Can't update this user informations", {
        username: req.params.username
    });
  }

  if ('password' in req.body) {
    update = true;
    u.password = req.body.password;
  }

  /* ignore accessLevel if not admin. no error */
  if (adm && 'accessLevel' in req.body) {
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
