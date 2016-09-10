/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var dirname = require('path').dirname;
var resolve = require('path').resolve;

var async = require('async');
var dateformat = require('dateformat');

var i18n = require('../i18n');
var DevWatch = require('../utils/devwatch');

var _devWatchers = {};
var devPath = __dirname + '/../../static/js/filehub';
function getDevScripts(admin, done) {
  var lists = {};
  var src = [
    { name: 'common', path: devPath }
  ];

  if (typeof admin !== 'boolean') {
    done = admin;
    admin = false;
  }

  if (admin) {
    src.push({ name: 'admin', path: devPath+'-admin' });
  }

  async.each(src, function (item, next) {
    if (!_devWatchers[item.name]) {
      _devWatchers[item.name] = new DevWatch(item.path);
    }
    _devWatchers[item.name].getList((list) => {
      lists[item.name] = list;
      next();
    });
  }, function (err) {
    if (err) return;
    done(lists);
  });
}

module.exports = function webui(app) {
  var ui = require('express').Router();

  var devPath

  if (app.uiErrorHandler == null) {
    app.uiErrorHandler = function (err, req, res, next) {
      if (!err) return next();

      if (res.headersSent) return res.end();

      res.status(err.statusCode || 500);
      res.render('error');
    };
  }

  i18n(app.config.i18n, app);

  ui.use(function (req, res, next) {
    res.locals.app = app;
    res.locals.dateformat = dateformat;
    res.locals.formatSize = i18n.formatSize;
    res.locals.req = req;
    res.locals.res = res;
    res.locals.baseUrl = req.baseUrl;

    if (!res.locals.staticUrl) {
      var base = dirname(req.baseUrl);
      res.locals.staticUrl = (base === '.' ? '' : base) + '/static';
    }

    if (app.get('env') !== 'development' || req.method !== 'GET') {
      return next();
    } else {
      // Ensure client-side development scripts lists are initialized
      getDevScripts(req.isAuthenticated() && req.user.is('admin'), function (lists) {
        res.locals.devScripts = lists;
        next();
      });
    }
  });

  var bodyparse = require('body-parser').urlencoded({ extended: true });
  ui.route('/login')
  .get(function (req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect(303, req.baseUrl + '/folders');
    }

    return res.render('login', {
      menuCtx: 'login',
      err: +(req.query.fail) ? i18n.t('login-failure') : null
    });
  })
  .post(bodyparse, function (req, res, next) {
    app.passport.authenticate('local', function (err, user, info) {
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

  ui.post('/logout', function (req, res, next) {
    req.logout();
    res.redirect(303, req.baseUrl + '/login');
  });

  ui.use(function (req, res, next) {
    if (!req.isAuthenticated()) {
      if (req.method === 'GET' && req.get('X-Filehub-Redirect') !== 'disabled') {
        return res.redirect(303, req.baseUrl + '/login');
      }

      return res.status(401).render('error', {
        loginLink: req.baseUrl + '/login'
      });
    }
    next();
  });

  /* The following routes are sorted by projected load (highest first) */

  ui.use('/folders', require('./browse')(app.mgr));

  ui.get('/profile', function (req, res, next) {
    res.render('profile', { menuCtx: 'profile' });
  });

  ui.get('/accounts', function (req, res, next) {
    if (!req.user || !req.user.is('admin')) {
      return res.status(403).render('error');
    }

    res.render('accounts', {
      menuCtx: 'accounts',
      accounts: app.mgr.listUsers()
    });
  });

  ui.get('/', function (req, res, next) {
    res.redirect(303, req.baseUrl + '/folders');
  });

  if (app.get('env') !== 'development'
      && typeof app.uiErrorHandler === 'function'
      && app.uiErrorHandler.length === 4) {
    ui.use(app.defaultErrorHandler);
  }

  return ui;
};
