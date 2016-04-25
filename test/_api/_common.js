/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var async = require('async');
var request = require('supertest');

var bootApp = require('../_bootstrap.js');

exports.api = function api(target, setupFn) {
  describe(target, function () {
    var agent;

    if (process.env.FILEHUB_TEST_ADDR) {
      agent = request.agent(process.env.FILEHUB_TEST_ADDR);
    } else {
      agent = request.agent(bootApp());
    }

    setupFn(agent, exports.test, exports.describeAs.bind(agent));
  });
}

exports.asUserHooks = function asUserHooks(agent, user) {
  before(function (done) {
    agent.post('/api/login')
         .type('json')
         .send({ username: user, password: 'test' })
         .end(done);
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
    async.waterfall(requests.map(function (r) {
      return function (next) {
        r().end(function (err) { next(err); });
      };
    }), done);
  });
};
