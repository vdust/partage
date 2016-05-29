/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var dirname = require('path').dirname;

var dateformat = require('dateformat');

var i18n = require('../i18n');

module.exports = function webui(app) {
  var ui = require('express').Router();

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
    next();
  });

  var bodyparse = require('body-parser').urlencoded({ extended: true });
  ui.route('/login')
  .get(function (req, res, next) {
    if (req.isAuthenticated()) {
      return res.redirect(303, req.baseUrl + '/folders');
    }

    return res.render('login', {
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
      if (req.method === 'GET') {
        return res.redirect(303, req.baseUrl + '/login');
      }

      return res.status(403).render('error', {
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

  ui.get('/users', function (req, res,next) {
    if (!req.user || !req.user.is('admin')) {
      return res.status(403).render('error');
    }

    res.render('users', {
      menuCtx: 'users',
      users: app.mgr.listUsers()
    });
  });

  ui.get('/', function (req, res, next) {
    res.redirect(303, req.baseUrl + '/folders');
  });

  if (app.get('env') !== 'development'
      && typeof app.defaultErrorHandler === 'function'
      && app.defaultErrorHandler.length === 4) {
    ui.use(app.defaultErrorHandler);
  }

  return ui;
};
