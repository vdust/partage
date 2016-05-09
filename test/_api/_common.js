/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var async = require('async');
var request = require('supertest');

var bootApp = require('../_bootstrap.js');

exports.api = function api(target, opts, setupFn) {
  if (typeof opts === 'function') {
    setupFn = opts;
    opts = {};
  }

  describe(target, function () {
    var agent = request.agent(bootApp(opts));
    setupFn(agent, exports.test, exports.describeAs.bind(agent));
  });
}

exports.asUserHooks = function asUserHooks(agent, user) {
  before(function (done) {
    agent.post('/api/login')
         .type('json')
         .send({ username: user, password: 'test' })
         .expect(200, done);
  });
  after(function (done) {
    agent.post('/api/logout').end(done);
  });
}

exports.describeAs = function describeAs(agent, user, fn) {
  if (typeof agent === 'string') {
    fn = user;
    user = agent;
    agent = this;
  }

  describe("as '"+user+"'", function () {
    exports.asUserHooks(agent, user);
    fn();
  });
};

exports.test = function test(desc, requests) {
  if (!requests || !requests.length) return it(desc);

  it(desc, function (done) {
    async.eachSeries(requests, function (r, next) {
      /* Not a supertest test builder. */
      if (r.length === 1) return r(next);

      r().end(function (err, res) {
        if (err) {
          console.log(err);
          if (res.headers) console.log(res.headers);
          if (res.body) console.log(res.body);
        }
        next(err);
      });
    }, done);
  });
};
