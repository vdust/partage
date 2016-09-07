#!/usr/bin/node

/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var path = require('path');
var readline = require('readline');

var async = require('async');
var fs = require('fs-extra');

var User = require('../lib/manager/user');
var utils = require('../lib/utils');

module.exports = function bootstrap(options, done) {
  if (typeof options === 'function') {
    done = options;
    options = {};
  }

  var _isSilent = false, rl;
  echo(); // Initialize echoing readline instance

  function echo() {
    if (rl && !_isSilent) return;

    if (rl) rl.close();

    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  function silent() {
    if (rl && _isSilent) return;
    if (rl) rl.close();
    rl = readline.createInterface({
      input: process.stdin,
      output: null
    });
    // overwrite default question to ensure question is written to stdout
    var _q = rl.question;
    rl.question = function (q, cb) {
      process.stdout.write(q);
      _q.call(rl, '', (answer) => {
        process.stdout.write("\n");
        cb(answer);
      });
    };
  }

  function log() {
    if (!options.verbose && !options.log) return;
    if (options.log) {
      options.log.apply(null, arguments);
    } else {
      console.error.apply(console, arguments);
    }
  }

  if (options.env) process.env.NODE_ENV = options.env;
  if (options.config) process.env.FILEHUB_CONFIG = options.config;

  function input(config, prompted, opts, next) {
    var validate = typeof opts.validate === 'function' ? opts.validate : (v) => v;
    var value = utils.keyValue(config, opts.key);

    if (!value) return ask();

    utils.keyValue(true, config, opts.key, validate(value));

    process.nextTick(next);

    function ask() {
      if (opts.silent) silent();
      rl.question(opts.q + " ", (answer) => {
        try {
          answer = validate(answer);
        } catch (e) {
          log("%s", e);
          return ask();
        }

        if (answer == null && !opts.allowEmpty) return ask();

        if (answer != null) {
          utils.keyValue(true, config, opts.key, answer);
          utils.keyValue(true, prompted, opts.key, answer);
        }

        echo();
        next();
      });
    }
  }

  function validatePath(required, p) {
    if (typeof required !== 'boolean') { p = required; required = true; }
    p = p.trim();
    if (!p && required) {
      throw new Error("Path required");
    } else if (p) {
      p = path.resolve(p);
      if (p === '/') throw new Error("Path must not resolve to /");
    }
    return p || null;
  }

  function validateName(n) {
    n = n.trim();
    if (n) User.checkName(n); else n = null;
    return n;
  }

  function validatePassword(p) {
    User.checkPassword(p);
    return p;
  }

  function requestMissing(config, prompted, series, cb) {
    async.eachSeries(series, (obj, _next) => input(config, prompted, obj, _next), cb);
  }

  var prompted = {};

  var actions = [
    (next) => {
      log("Loading configurations...");
      require('../lib/config')((c) => next(null, c), true);
    },
    (config, next) => {
      requestMissing(config, prompted, [
        { q: "Folders root directory:",
          key: 'foldersRoot',
          validate: validatePath },
        { q: "Sessions directory:",
          key: ['session', 'store', 'path'],
          validate: validatePath.bind(null, false) },
        { q: "Users file:",
          key: 'usersFile' },
      ], () => next(null, config));
    },
    (config, next) => {
      if (utils.keyValue(config, ['session', 'secret'])) {
        return next(null, config);
      }
      log("generating new store secret...");
      var secret = require('crypto').randomBytes(33).toString('base64');
      utils.keyValue(true, config, ['session', 'secret'], secret);
      utils.keyValue(true, prompted, ['session', 'secret'], secret);
      next(null, config);
    },
    (config, next) => {
      log("Checking folders root directory (create if missing)...");
      fs.ensureDir(config.foldersRoot, (err) => err ? next(err) : next(null, config));
    },
    (config, next) => {
      var p = utils.keyValue(config, ['session', 'store', 'path']);

      if (!p) next(null, config);

      log("Checking sessions directory (create if missing)...");
      fs.ensureDir(p, (err) => err ? next(err) : next(null, config));
    },
    (config, next) => {
      fs.stat(config.usersFile, function (err, stat) {
        if (!err && stat.isDirectory()) {
            return next(new Error(config.usersFile + " is not a file"));
        } else if (!err) {
          return next(null, config, false);
        } else if (err.code !== 'ENOENT') {
          return next(err);
        }

        log("Users file %s doesn't exist.", config.usersFile);

        var su = {};
        requestMissing(su, {}, [
          { q: "Superuser name:",
            key: 'name',
            validate: validateName },
          { q: "Superuser password:",
            key: 'password',
            silent: true,
            validate: validatePassword }
        ], () => next(null, config, su));
      });
    },
    (config, su, next) => {
      if (!su) return next(null, config);

      var user = new User(su.name);
      user.password = su.password;
      log("Writing %s", config.usersFile)
      fs.writeFile(config.usersFile, user.csv()+"\n", 'utf-8', (err) => {
        if (err) return next(err);
        next(null, config);
      })
    }
  ];

  if (!options['preserve-config']) {
    actions.push((config, next) => {
      var last = config.stack.slice(-1)[0];

      prompted = Object.keys(prompted).length ? prompted : null;

      // Don't overwrite default config if only file in stack
      if (!prompted || !last || config.stack.length === 1) {
        if (prompted) {
          log("Writable configuration file to save prompted values not found.");
        }
        return process.nextTick(next);
      }

      log("Saving prompted configuration in %s", last.path);

      var data = JSON.stringify(utils.merge(true, last.data, prompted), null, 2)+"\n";
      fs.writeFile(last.path, data, 'utf-8', next);
    });
  } else {
    actions.push((config, next) => next());
  }

  async.waterfall(actions, (err) => {
    if (rl) rl.close();
    done(err);
  });
}

function usage(full, exit) {
  var head = [
    'usage: bootstrap.js [-c FILE] [-e ENV] [-n]',
    '       bootstrap.js -h'
  ];
  var infos = [
    '',
    'Bootstrap filehub environment (Will prompt for missing configuration)',
    '',
    'Options:',
    '    Arguments required for long options apply to short options as well',
    '',
    '    -c, --config=FILE',
    "        Configuration file to load",
    '    -e, --env=ENV',
    "        Set NODE_ENV to this value. [default: 'production' if NODE_ENV is not set]",
    '    -n, --preserve-config',
    "        Don't save prompted values in configuration file",
    "    -h, --help",
    "        Show this help and exit."
  ]

  if (typeof full !== 'boolean') {
    exit = full;
    full = true;
  }

  var _usage = (full ? head.concat(infos) : head).join('\n');

  if (exit) {
    console.error(_usage);
  } else {
    console.log(_usage);
  }

  process.exit(exit||0);
}

if (require.main === module) {
  var parse = require('minimist');

  var options = parse(process.argv.slice(2), {
    'alias': {
      'c': 'config',
      'e': 'env',
      'h': 'help',
      'n': 'write-config',
      'q': 'quiet'
    },
    'boolean': [
      'h', 'help',
      'n', 'preserve-config',
      'q', 'quiet'
    ],
    'string': [
      'c', 'config',
      'e', 'env'
    ],
    'default': {
      'env': process.env.NODE_ENV||'production'
    },
    'unknown': function (opt) {
      console.error("Unknown option %s\n", opt);
      usage(false, 1);
    }
  });

  if (options.help) usage(); // exits the program

  options.verbose = !options.quiet;
  module.exports(options, function (err) {
    if (options.verbose) {
      if (err) console.error("%s", err);
      else console.error("done.");
    }
    process.exit(err ? 1 : 0);
  });
}
