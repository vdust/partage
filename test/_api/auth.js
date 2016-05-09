/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var api = require('./_common').api;

api('POST /api/login', function (agent, test) {
  test("should fail to sign in as unknown user", [
    () => agent.post('/api/login')
      .send({ username: 'unknown', password: 'unknown' })
      .expect(401)
  ]);

  test("should fail to sign in as known user with wrong password", [
    () => agent.post('/api/login')
      .send({ username: 'user', password: 'wrongpassword' })
      .expect(401)
  ]);

  test("should sign in as known user with correct password", [
    () => agent.post('/api/login')
      .send({ username: 'user', password: 'test' })
      .expect('Content-Type', /json/)
      .expect(200, {
        username: 'user',
        email: 'user@example.com',
        accessLevel: 'user'
      })
  ]);
});

api('POST /api/logout', function (agent, test) {
  test("should not fail if no user is signed in", [
    () => agent.post('/api/logout')
      .expect('Content-Type', /json/)
      .expect(200, {})
  ]);

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
