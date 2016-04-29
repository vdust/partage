/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var api = require('./_common').api;
var async = require('async');

api('POST /api/login', function (agent) {
  it("should fail to sign in as unknown user", function (_done) {
    function done(err, res) {
      if (err) {
        console.log(err);
        console.log(res.body);
      }
      _done.apply(this, arguments);
    }
    agent.post('/api/login')
      .type('json')
      .send({ username: 'unknown', password: 'unknown' })
      .expect(401, done);
  });

  it("should fail to sign in as known user with wrong password", function (done) {
    agent.post('/api/login')
      .type('json')
      .send({ username: 'visitor', password: 'wrongpassword' })
      .expect(401, done);
  });

  it("should sign in as known user with correct password", function (done) {
    agent.post('/api/login')
      .type('json')
      .send({ username: 'visitor', password: 'test' })
      .expect('Content-Type', /json/)
      .expect(200, {
        username: 'visitor',
        email: 'visitor@example.com',
        accessLevel: 'visitor'
      }, done);
  });
});

api('POST /api/logout', function (agent, test) {
  it("should not fail if no user is signed in", function (done) {
    agent.post('/api/logout')
      .expect('Content-Type', /json/)
      .expect(200, {}, done);
  });

  test("should sign user out", [
    () => agent.post('/api/login')
      .type('json')
      .send({ username: 'admin', password: 'test' })
      .expect(200),
    () => agent.post('/api/logout')
      .expect('Content-Type', /json/)
      .expect(200, {}),
    () => agent.get('/api/user/admin')
      .expect(401)
  ]);
});

