/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

require('./monkeys'); /* do some monkey patching */

var resolve = require('path').resolve;
var URL = require('url');

var async = require('async');
var express = require('express');
var session = require('express-session');
var Passport = require('passport').Passport;
var LocalStrategy = require('passport-local').Strategy;

var Manager = require('./manager');
var configure = require('./config');

function notfound(req, res) {
  var status = 404;
  if (req.method !== 'GET' && req.method !== 'OPTIONS') {
    status = 405;
    res.set('Allow', 'GET, OPTIONS');
  }
  res.sendStatus(status);
}


module.exports = function app() {
  var app = express();

  /**
   * bootstrapping stuff
   */
  var boot;
  var isbootstrapped = false;
  var booterrors = [];
  function bootstrapped() {
    if (isbootstrapped) {
      app.emit('bootstrapped', booterrors.length ? booterrors : undefined);
    }
    return isbootstrapped;
  }
  function taskcb(err) {
    if (!err) return;
    if (typeof err !== 'string') {
      err = err.message || err.toString();
    }
    booterrors.push(err);
  }
  function newtask(fn) {
    if (!boot) return;
    boot.push(fn, taskcb);
  }

  app.bootTask = newtask;

  app.bootstrap = function bootstrap(cb) {
    if (cb) app.once('bootstrapped', cb);
    if (boot || bootstrapped()) return;

    boot = async.queue(function bootWorker(task, callback) {
      task(callback);
    });

    boot.drain = function onBootDrain() {
      isbootstrapped = true;
      bootstrapped();
    };

    function onConfigure(done) {
      /* Let external apps queue extra tasks */
      app.emit('pt-config-loaded', newtask);

      newtask(function (next) {
        app.checkConfig(); /* exits program if not valid */

        var conf = app.config;

        app.locals.poweredBy = (conf.footer||{}).poweredBy;
        app.locals.contact = (conf.footer||{}).contact;
        app.set('title', conf.title || 'Partage');

        app.mgr = new Manager(conf.usersFile, conf.foldersRoot, conf.specials);
        app.mgr.init(next);
      });

      newtask(function (next) {
        app.emit('pt-before-routes', newtask);
        newtask(function (_next) {
          app._setupRoutes();
          app.emit('pt-after-routes', newtask);
          process.nextTick(_next);
        });
        process.nextTick(next);
      });

      process.nextTick(done);
    }

    /* load config first */
    newtask(function (done) {
      configure(function (config) {
        app.config = config;
        /* continue bootstrapping */
        onConfigure(done);
      });
    });
  };

  app.run = function run(abortOnError, done) {
    app.bootstrap(function (err) {
      err = err || [];

      for (var i = 0 ; i < err.length; i++) {
        console.error(err[i]);
      }

      if (err.length && abortOnError) {
        return typeof done === 'function' ? done(false) : undefined;
      }

      process.nextTick(function () {
        var port = app.config.run.port;
        var server = app.server = app.listen(port, function () {
          var host = server.address().address;
          var port = server.address().port;
          var path = app.path();
          if (typeof path !== 'string') path = path[0]||'';
          if (host = '::') host = '0.0.0.0';
          console.log("App listening at http://%s:%s%s/", host, port, path);
        });

        if (typeof done === 'function') {
          app.server.on('close', () => done());
        }
      });
    });
  };

  app.checkConfig = function checkConfig() {
    var c = app.config, err, store, module;

    if (!c) {
      err = "Missing configuration object";
    } else if (!c.usersFile) {
      err = "Missing usersFile in configuration";
    } else if (!c.foldersRoot) {
      err = "Missing foldersRoot in configuration";
    }

    if (err) {
      console.error(err);
      process.exit(1);
    }

    c.usersFile = resolve(c.usersFile);
    c.foldersRoot = resolve(c.foldersRoot);

    if (c.session && c.session.store) {
      store = c.session.store;
      module = require(store.module||'session-file-store')(session);
      delete store.module;
      c.session.store = new module(store);
    }
  };

  app.set('views', resolve(__dirname, '../views'));
  app.set('view engine', 'pug');

  if (app.get('env') === 'development') {
    app.set('json spaces', 2);
  }

  var passport = app.passport = new Passport();

  passport.use(new LocalStrategy(function (username, password, done) {
    var u = app.mgr.user(username);

    if (!u || !u.passwordCheck(password)) {
      return done(null, false, { message: 'Invalid username or password.' });
    }

    return done(null, u);
  }));
  passport.serializeUser(function (user, done) {
    done(null, user.name);
  });
  passport.deserializeUser(function (username, done) {
    done(null, app.mgr.user(username));
  });

  app._routesLoaded = false;
  app._setupRoutes = function _setupRoutes() {
    if (app._routesLoaded) return;

    if (app.config.log && app.config.log.format) {
      app.use(require('morgan')(app.config.log.format));
    }

    if (app.config.static) {
      // If static is false and webui is enabled, static files should be
      // served by a proxying server (nginx, httpd) under /static/ url.
      // /favicon.ico and /robots.txt should also be served if needed.
      app.use('/static', [
        express.static(resolve(__dirname, '../static')),
        express.static(resolve(__dirname, '../_dist')),
        notfound
      ]);

      app.use('/', express.static(resolve(__dirname, '../rootassets')));
    }

    app.use(session(app.config.session));
    app.use(passport.initialize());
    app.use(passport.session());

    app.use('/api', require('./api')(app.mgr, app));

    if (!app.config.disableWebUI) {
      app.use(function (req, res, next) {
        res.locals.staticUrl = req.baseUrl + '/static';
        next();
      });

      app.use('/', require('./webui')(app));
    }

    app._routesLoaded = true;
  };

  return app;
};
