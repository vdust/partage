'use strict';
/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

var fs = require('fs-extra');
var path = require('path');

var async = require('async');
var crypt = require('crypt3');

var testRoot = '/tmp/filehub-tests-'+process.pid;

var makeTree = require('../lib/utils/fs').makeTree;
var app = require('../lib/app');
var Trash = require('../lib/manager/trash');
var resetUidGenerator = require('../lib/manager/folder')._resetUidGenerator;

function mkTree(root, files) {
  
}

module.exports = function _bootstrap(options) { 
  var config = {
    foldersRoot: path.join(testRoot, 'folders'),
    i18n: { debug: false, saveMissing: true },
    log: process.env.DEBUG ? { format: 'dev' } : false,
    session: {
      secret: 'filehub-123',
      store: { path: path.join(testRoot, 'sessions') }
    },
    usersFile: path.join(testRoot, 'users.pwd')
  };

  options = options || {};

  var pwd = crypt('test', '$6$abc123');
  var users = ([
    [ 'user', pwd, 'user', '0', 'user@example.com' ],
    [ 'user2', pwd, 'user2', '0', 'user2@example.com' ],
    [ 'admin', pwd, 'admin', '0', 'admin@example.com' ],
    [ 'super', pwd, 'su', '0', 'su@example.com' ]
  ]).map(function (r) { return r.join(':') }).join("\n");

  var admPath = path.join(config.foldersRoot, 'adminonly');

  var roConf = JSON.stringify({
    description: 'Read-only folder',
    accessList: [ 'user' ]
  });
  var roPath = path.join(config.foldersRoot, 'readonly');

  var rwConf = JSON.stringify({
    description: 'Read-write folder',
    accessList: [ '+user' ]
  });
  var rwPath = path.join(config.foldersRoot, 'readwrite');

  var _app = app();

  before(function (done) {
    process.env.NODE_ENV = 'test';
    var cnfile = process.env.FILEHUB_CONFIG = path.join(testRoot, 'config.json');

    resetUidGenerator();

    var mtime = new Date('2016-01-01 00:00:00 GMT');

    // Create test env under /tmp/filehub-test-NNN/
    var tree = {
      'folders/': {
        'adminonly/': {
          'subdir/': {},
          'test.txt': { mtime: mtime, data: 'test' }
        },
        'readonly/': {
          'subdir/': {
            'recursive/': {}
          },
          '.fhconfig': roConf,
          'test.txt': { mtime: mtime, data: 'test' }
        },
        'readwrite/': {
          'existdir/': {},
          '.fhconfig': rwConf,
          'exist.txt': { mtime: mtime, data: 'test' }
        }
      },
      'sessions/': {},
      'config.json': { data: config },
      'users.pwd': users+"\n"
    };

    async.waterfall([
      function (next) { fs.emptyDir(testRoot, function(err) { next(err); }); },
      (next) => makeTree(testRoot, tree, next),
      _app.bootstrap.bind(_app)
    ], function (err) {
      if (err) {
        throw err;
      }
      done();
    });
  });

  var beforeEachActions = [];
  var afterEachActions = [];

  if (Array.isArray(options.trash) && options.trash.length) {
    var trashDir = path.join(config.foldersRoot, '.trash');

    beforeEachActions.push((next) => fs.emptyDir(trashDir, (err) => next(err)));

    var trashDate = new Date('2016-01-01 00:00:00 GMT');

    options.trash.forEach(function (p) {
      if (!p) return;

      var isDir = p.substr(-1) === '/';

      p = p.replace(/\/+$/, '');

      var dest = path.join(trashDir, Trash.buildUid(isDir, trashDate, p));

      if (isDir) {
        beforeEachActions.push(fs.mkdir.bind(null, dest));
      } else {
        beforeEachActions.push(fs.writeFile.bind(null, dest, p, 'utf-8'));
      }
    });
  }

  if (beforeEachActions.length) {
    beforeEach((done) => async.waterfall(beforeEachActions, done));
  }

  if (afterEachActions.length) {
    afterEach((done) => async.waterfall(afterEachActions, done));
  }

  after(function (done) {
    fs.remove(testRoot, done);
  });

  return _app;
};

module.exports.testRoot = testRoot;
