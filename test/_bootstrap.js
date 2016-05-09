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

var app = require('../lib/app');
var Trash = require('../lib/manager/trash');
var resetUidGenerator = require('../lib/manager/folder')._resetUidGenerator;

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

    var mtimeRef = Math.floor((new Date('2016-01-01 00:00:00 GMT')).getTime() / 1000);

    /* Create test env
     *
     * /tmp/filehub-test-NNN/
     *   + folders/
     *   |  + adminonly/
     *   |  |  + subdir/
     *   |  |  + test.txt
     *   |  + readonly/
     *   |  |  + subdir/
     *   |  |  + .fhconfig
     *   |  |  + test.txt
     *   |  + readwrite/
     *   |     + existdir/
     *   |     + .fhconfig
     *   |     + exist.txt
     *   + sessions/
     *   + config.json
     *   + users.pwd
     */
    async.waterfall([
      function (next) { fs.emptyDir(testRoot, function(err) { next(err); }); },
        fs.mkdir.bind(null, config.foldersRoot),
          fs.mkdir.bind(null, admPath),
            fs.mkdir.bind(null, path.join(admPath, 'subdir')),
            fs.writeFile.bind(null, path.join(admPath, 'test.txt'), 'test', 'utf-8'),
            fs.utimes.bind(null, path.join(admPath, 'test.txt'), mtimeRef, mtimeRef),
          fs.mkdir.bind(null, roPath),
            fs.mkdir.bind(null, path.join(roPath, 'subdir')),
            fs.writeFile.bind(null, path.join(roPath, '.fhconfig'), roConf, 'utf-8'),
            fs.writeFile.bind(null, path.join(roPath, 'test.txt'), 'test', 'utf-8'),
            fs.utimes.bind(null, path.join(roPath, 'test.txt'), mtimeRef, mtimeRef),
          fs.mkdir.bind(null, rwPath),
            fs.mkdir.bind(null, path.join(rwPath, 'existdir')),
            fs.writeFile.bind(null, path.join(rwPath, '.fhconfig'), rwConf, 'utf-8'),
            fs.writeFile.bind(null, path.join(rwPath, 'exist.txt'), 'test', 'utf-8'),
            fs.utimes.bind(null, path.join(rwPath, 'exist.txt'), mtimeRef, mtimeRef),
        fs.mkdir.bind(null, config.session.store.path),
        fs.writeFile.bind(null, cnfile, JSON.stringify(config), 'utf-8'),
        fs.writeFile.bind(null, config.usersFile, users+"\n", 'utf-8'),
      _app.bootstrap.bind(_app)
    ], function (err) {
      if (err) throw err;
      done();
    });
  });

  if (Array.isArray(options.trash) && options.trash.length) {
    var trashDir = path.join(config.foldersRoot, '.trash');

    var trashActions = [
      (next) => fs.emptyDir(trashDir, (err) => next(err)),
    ];

    var trashDate = new Date('2016-01-01 00:00:00 GMT');

    options.trash.forEach(function (p) {
      if (!p) return;

      var isDir = p.substr(-1) === '/';

      p = p.replace(/\/+$/, '');

      var dest = path.join(trashDir, Trash.buildUid(isDir, trashDate, p));

      if (isDir) {
        trashActions.push(fs.mkdir.bind(null, dest));
      } else {
        trashActions.push(fs.writeFile.bind(null, dest, p, 'utf-8'));
      }
    });

    beforeEach(function (done) {
      async.waterfall(trashActions, done);
    });
  }

  after(function (done) {
    fs.remove(testRoot, done);
  });

  return _app;
};

module.exports.testRoot = testRoot;
