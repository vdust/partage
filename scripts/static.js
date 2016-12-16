#!/usr/bin/node

/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

var resolve = require('path').resolve;
var pJoin = require('path').join;
var readline = require('readline');

var async = require('async');
var fs = require('fs-extra');
var glob = require('glob');
var uglify = require('uglify-js');
var sass = require('node-sass');

var utils = require('../lib/utils');

var banner = [
  "/* partage",
  " * Copyright (c) 2016 Raphaël Bois Rousseau",
  " * ISC Licensed",
  " */\n" ].join("\n");

module.exports = function saveStatic(path, options, done) {
  var opts = {
    batch: true,
    staticPath: 'static',
    // thoses files are bundled by uglify later and are not needed in production
    // regexp matches path relative to staticPath
    prodExclude: /^js\/(?:partage|_defines.js$)/,
    scssPath: 'scss'
  };

  if (typeof options === 'function') {
    done = options;
    options = {};
  }

  utils.merge(opts, options);

  var rl;
  if (!opts.batch) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr
    });
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

  path = resolve(path);

  var staticPath = resolve(opts.staticPath);
  var prodExclude = opts.prodExclude instanceof RegExp
    ? opts.prodExclude
    : new RegExp(opts.prodExclude);
  var scssPath = resolve(opts.scssPath);

  var actions = [
    (next) => {
      log("Static files location: "+path+" ...");
      if (rl && !opts.dry) {
        rl.question("Any file in destination folder will be removed. Continue ? [yes/No] ",
          (answer) => {
            answer = answer.toLowerCase();
            if (answer !== 'yes') {
              return next(new Error("Operation aborted by user."));
            }
            next();
          });
      } else {
        next();
      }
    },
    (next) => {
      log("Clearing contents of destination folder");
      if (opts.dry) return next();
      fs.emptyDir(path, (err) => {
        // Add a wrapping function because fs-extra sometimes add undocumented
        // debug crap as extra callback parameters, which be don't want to
        // propagate in an unreliable way.
        next(err);
      });
    },
    (next) => {
      log("\nCopying static files...");
      var walk = fs.walk(staticPath);
      var items = [];
      walk.on('readable', function () {
        var item, relpath;
        while ((item = this.read())) {
          if (item.stats.isDirectory()) continue; // ignores directories
          relpath = item.path.slice(staticPath.length+1);
          if (!prodExclude.test(relpath)) {
            items.push({
              path: item.path,
              dest: resolve(path, relpath)
            });
          }
        }
      }).on('end', () => {
        async.eachLimit(items, 4, (item, _n) => {
          log("    %s -> %s", item.path, item.dest);
          if (opts.dry) return process.nextTick(_n);
          fs.copy(item.path, item.dest, (err) => _n(err));
        }, next);
      });
    },
    (next) => {
      log("\nMinifying 'partage' scripts...");
      var files = [
        {
          dest: 'js/partage.min.js',
          src: [
            'js/partage.js',
            'js/partage/*.js'
          ]
        },
        {
          dest: 'js/partage-admin.js',
          src: [
            'js/partage-admin.js',
            'js/partage-admin/*.js'
          ]
        }
      ];

      var globOpts = {
        cwd: staticPath,
        nodir: true
      };

      async.eachLimit(files, 4, (item, _n) => {
        var dest = resolve(path, item.dest);
        var files = [];

        async.each(item.src, (s, __n) => {
          if (s.indexOf('*') < 0) { // no glob
            files.push(s);
            __n();
          } else {
            glob(s, globOpts, (err, matches) => {
              if (err) return __n(err);
              files = files.concat(matches);
              __n();
            });
          }
        }, (err) => {
          files = files.map((s) => pJoin(opts.staticPath, s));

          log("    %s -> %s", JSON.stringify(files), dest);

          if (opts.dry) return process.nextTick(_n);

          var code = banner + uglify.minify(files, {
            compress: {
              dead_code: true,
              global_defs: { PROD: true }
            }
          });

          fs.outputFile(dest, code, 'utf-8', (err) => _n(err));
        });
      }, next);
    },
    (next) => {
      log("\nRendering css file...");
      var files = [
        {
          dest: 'css/partage.css',
          src: pJoin(opts.scssPath, 'partage.scss')
        },
        {
          dest: 'css/partage-admin.css',
          src: pJoin(opts.scssPath, 'partage-admin.scss')
        }
      ];

      async.eachLimit(files, 4, (item, _n) => {
        var dest = resolve(path, item.dest);
        var o = {
          file: item.src,
          includePaths: [ scssPath ],
          outputStyle: 'compressed'
        };

        log("    %s -> %s", item.src, dest);

        if (opts.dry) return process.nextTick(_n);

        sass.render(o, (err, result) => {
          if (err) return _n(err);
          fs.outputFile(dest, result.css, 'utf-8', (err) => _n(err));
        });
      }, next);
    }
  ];

  async.waterfall(actions, (err) => {
    if (rl) rl.close();
    done(err);
  });
};

function usage(full, exit) {
  var head = [
    'usage: static.js [-e ENV] [-n] DIR',
    '       static.js -h'
  ];
  var infos = [
    '',
    'Save static files to be served externally',
    '',
    'Options:',
    '    Arguments required for long options apply to short options as well',
    '',
    '    -B, --batch',
    "        Don't prompt for confirmations.",
    '    -e, --env=ENV',
    "        Set NODE_ENV to this value. [default: 'production' if NODE_ENV is not set]",
    '    -n, --dry-run',
    "        Don't actually save files, just list files to be saved",
    '    -q, --quiet',
    "        Don't print anything to standard output or standard error.",
    '    -h, --help',
    '        Show this help and exit.'
  ];

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

  process.exit(exit || 0);
}

if (require.main === module) {
  var parse = require('minimist');

  var options = parse(process.argv.slice(2), {
    'alias': {
      'B': 'batch',
      'e': 'env',
      'h': 'help',
      'n': 'dry',
      'dry-run': 'dry',
      'q': 'quiet'
    },
    'boolean': [
      'B', 'batch',
      'h', 'help',
      'n', 'dry-run',
      'q', 'quiet'
    ],
    'string': [
      'e', 'env'
    ],
    'default': {
      'env': process.env.NODE_ENV || 'production',
      'batch': false
    },
    'unknown': function (opt) {
      if (opt[0] !== '-') return true;
      console.error("Unknown option %s\n", opt);
      usage(false, 1);
    }
  });

  if (options.help) usage(); // exists the program

  if (options._.length !== 1) {
    if (!options.quiet) {
      if (!options._.length) {
        console.error("Missing destination directory.");
      } else {
        console.error("Too many positional arguments.");
      }
      usage(false, 1);
    }
    process.exit(1);
  }

  var path = options._[0];
  delete options._;

  options.verbose = !options.quiet;
  module.exports(path, options, (err) => {
    if (options.verbose) {
      if (err) console.error("%s", err);
      else console.error("done.");
    }

    process.exit(err ? 1 : 0);
  });
}
