/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

require('./monkeys'); /* do some monkey patching */

var fs = require('fs');
var resolve = require('path').resolve;
var format = require('util').format;
var URL = require('url');

var async = require('async');
var dateformat = require('dateformat');
var express = require('express');
var session = require('express-session');
var Passport = require('passport').Passport;
var LocalStrategy = require('passport-local').Strategy;

var i18n = require('./i18n');
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
      app.emit('fh-config-loaded', newtask);

      newtask(function (next) {
        app.checkConfig(); /* exits program if not valid */

        var conf = app.config;

        app.locals.poweredBy = (conf.footer||{}).poweredBy;
        app.locals.contact = (conf.footer||{}).contact;
        app.set('title', conf.title || 'File Hub');

        app.mgr = new Manager(conf.usersFile, conf.foldersRoot, conf.specials);
        app.mgr.init(next);
      });

      newtask(function (next) {
        app.emit('fh-pre-routing', newtask);
        newtask(function (_next) {
          app._setupRoutes();
          app.emit('fh-post-routing', newtask);
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

  app.run = function run(abortOnError) {
    app.bootstrap(function (err) {
      var errs=0;
      (err||[]).forEach(function (e) {
        errs++;
        console.error(e);
      });

      if (errs && abortOnError) return;

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
  app.set('view engine', 'jade');

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

  app.locals.app = app;
  app.locals.dateformat = dateformat;
  app.locals.formatSize = i18n.formatSize;

  /* apply middleware except on provided path prefixes */
  function except(paths, middleware) {
    return function (req, res, next) {
      var i, p;
      for (i = 0; i < paths.length; i++) {
        p = paths[i].replace(/\/+$/, '');
        if (req.path === p || req.path.substr(0, p.length+1) === (p + '/')) {
          return next();
        }
      }
      middleware(req, res, next);
    };
  }

  app._routesLoaded = false;
  app._setupRoutes = function _setupRoutes() {
    if (app._routesLoaded) return;

    if (app.config.log && app.config.log.format) {
      app.use(require('morgan')(app.config.log.format));
    }

    app.get(['/robots.txt', '/favicon.ico'], function (req, res, next) {
      if (req.baseUrl !== '') {
        return res.sendStatus(404);
      }
      res.sendFile(req.path.replace(/\/+/g, ''), {
        root: resolve(__dirname, '..')
      }, function (err) {
        if (err) return res.sendStatus(404);
      });
    });

    var exceptStatic = except.bind(this, [ '/static' ]);
    app.use(exceptStatic(session(app.config.session)));
    app.use(exceptStatic(passport.initialize()));
    app.use(exceptStatic(passport.session()));

    var exceptNoAuth = except.bind(this, [
      '/static',
      '/api'
    ]);
    app.use(exceptNoAuth(function (req, res, next) {
      var path;

      /* setting up common local variables for templates */
      res.locals.req = req;
      res.locals.res = res;
      res.locals.baseUrl = req.baseUrl;

      /* check auth */
      if (!req.isAuthenticated()) {
        path = req.path.split('/');
        switch (path[1]) {
          /* exceptions */
          case 'login':
          case 'logout':
            break;
          default:
            if (req.method === 'GET') {
              return res.redirect(303, req.baseUrl + '/login');
            } else {
              return res.sendStatus(403);
            }
        }
      }
      process.nextTick(next);
    }));

    /* setup i18n and lang detection handler */
    i18n(app.config.i18n, app);

    app.get('/', function (req, res, next) {
      res.redirect(303, req.baseUrl + '/folders');
    });

    var bodyparse = require('body-parser').urlencoded({ extended: true });

    app.route('/login')
    .get(function (req, res, next) {
      if (req.isAuthenticated()) {
        return res.redirect(303, req.baseUrl + '/folders');
      }
      return res.render('login', {
        err: +(req.query.fail) ? i18n.t("filehub.login-failure") : null
      });
    })
    .post(bodyparse, function (req, res, next) {
      passport.authenticate('local', function (err, user, info) {
        if (err) return next(err);
        if (!user) {
          return res.redirect(303, req.baseUrl + '/login?fail=1');
        }
        req.login(user, function (err) {
          if (err) return next(err);
          return res.redirect(303, req.baseUrl + '/folders');
        });
      })(req, res, next);
    });

    app.post('/logout', function (req, res, next) {
      req.logout();
      res.redirect(303, req.baseUrl + '/login');
    });

    app.get('/users', function (req, res, next) {
      if (!req.user || !req.user.is('admin')) {
        return res.status(403).render('error');
      }
      res.render('users', {
        menuCtx: 'users',
        users: app.mgr.listUsers()
      });
    });

    app.get('/profile', function (req, res, next) {
      res.render('profile', {
        menuCtx: 'profile'
      });
    });

    app.use('/static', express.static(resolve(__dirname, '../static')), notfound);
    app.use('/folders', require('./browse')(app.mgr));
    app.use('/api', require('./api')(app.mgr, app));

    app._routesLoaded = true;
  };

  return app;
};
