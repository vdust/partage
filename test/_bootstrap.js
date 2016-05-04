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
var resetUidGenerator = require('../lib/manager/folder')._resetUidGenerator;

module.exports = function _bootstrap() { 
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

  var pwd = crypt('test', '$6$abc123');
  var users = ([
    [ 'visitor', pwd, 'visitor', '0', 'visitor@example.com' ],
    [ 'contrib', pwd, 'contributor', '0', 'contrib@example.com' ],
    [ 'admin', pwd, 'admin', '0', 'admin@example.com' ],
    [ 'super', pwd, 'su', '0', 'su@example.com' ]
  ]).map(function (r) { return r.join(':') }).join("\n");

  var admPath = path.join(config.foldersRoot, 'adminonly');

  var roConf = JSON.stringify({
    description: 'Read-only folder',
    accessList: [ 'visitor', '!contrib' ]
  });
  var roPath = path.join(config.foldersRoot, 'readonly');

  var rwConf = JSON.stringify({
    description: 'Read-write folder',
    accessList: [ 'visitor', 'contrib' ]
  });
  var rwPath = path.join(config.foldersRoot, 'readwrite');

  var _app = app();

  before(function (done) {
    process.env.NODE_ENV = 'test';
    var cnfile = process.env.FILEHUB_CONFIG = path.join(testRoot, 'config.json');

    resetUidGenerator();

    var mtimeRef = Math.floor((new Date('01-01-2016 00:00:00 GMT')).getTime() / 1000);

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

  after(function (done) {
    fs.remove(testRoot, done);
  });

  return _app;
};

module.exports.testRoot = testRoot;
