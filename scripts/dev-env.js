#!/usr/bin/node

/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var path = require('path');

var fs = require('fs-extra');
var async = require('async');

var User = require('../lib/manager/user');
var makeTree = require('../lib/utils/fs').makeTree;

function setupFolders(root, tree, done) {
  async.waterfall([
    (next) => fs.stat(root, (err) => next(err ? null : 'skip')),
    (next) => makeTree(root, tree, next)
  ], (err) => done(err !== 'skip' ? err : null));
}

function setupUsers(file, done) {
  function _pass(u) { u.password = u.name; }

  var users = [
    [ 'admin', _pass, 'su', false, 'admin@example.com' ],
    [ 'admin1', _pass, 'admin', false, 'admin1@example.com' ],
    [ 'admin2', _pass, 'admin', false, 'admin2@example.com' ],
    [ 'user1', _pass, 'user', false, 'user1@example.com' ],
    [ 'user2', _pass, 'user', false, 'user2@example.com' ],
    [ 'user3', _pass, 'user', false, 'user3@example.com' ]
  ];

  async.waterfall([
    (next) => fs.stat(file, (err) => next(err ? null : 'skip')),
    // bootstrap only if users file doesn't exist already
    (next) => fs.writeFile(file, users.map((u) => (new User(u)).csv()).join('\n')+'\n', next)
  ], (err) => done(err !== 'skip' ? err : null));
}

var bootstrap = module.exports = function bootstrap(clean, done) {
  if (typeof clean === 'function' ) {
    done = clean;
    clean = false;
  }

  require('../lib/config')(function (config) {
    var actions = [];

    if (clean) {
      actions = [
        (next) => fs.remove(config.session.store.path, (err) => next(err)),
        (next) => fs.remove(config.foldersRoot, (err) => next(err)),
        (next) => fs.remove(config.usersFile, (err) => next(err))
      ];
    }

    actions = actions.concat([
      setupFolders.bind(null, config.foldersRoot, config.foldersDevTree),
      setupUsers.bind(null, config.usersFile),
      (next) => fs.ensureDir(config.session.store.path, (err) => next(err))
    ]);

    async.waterfall(actions, done || (() => null));
  });
};

if (require.main === module) {
  process.env.NODE_ENV = 'development';

  var clean = process.argv[2];

  console.error("Bootstrapping dev environment (clean: %j)...", !!clean);
  bootstrap(clean === 'clean', function (err) {
    if (err) {
      console.error("%s", err);
      return process.exit(1);
    }
    console.error("Dev environment ready.");

    require('../lib').run(true);
  });
}
