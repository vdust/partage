/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

var api = require('./_common').api;

api("* /api/account/:username", function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/account/user').expect(401),
    () => agent.get('/api/account/unknown').expect(401),
    () => agent.head('/api/account/user').expect(401),
    () => agent.head('/api/account/unknown').expect(401),
    () => agent.put('/api/account/user').expect(401),
    () => agent.put('/api/account/unknown').expect(401),
    () => agent.del('/api/account/user').expect(401),
    () => agent.del('/api/account/unknown').expect(401)
  ]);
});

api("GET /api/account/:username", function (agent, test, as) {
  as('user', function () {
    test("should get 'user' informations", [
      () => agent.get('/api/account/user')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'user',
          email: 'user@example.com',
          accessLevel: 'user'
        })
    ]);

    test("should get forbidden response on other users", [
      () => agent.get('/api/account/user2').expect(403)
    ]);

    test("should get forbidden response on unknown users", [
      () => agent.get('/api/account/unknown').expect(403)
    ]);
  });

  as('admin', function () {
    test("should get 'user2' informations", [
      () => agent.get('/api/account/user2')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'user2',
          email: 'user2@example.com',
          accessLevel: 'user'
        })
    ]);

    test("should get 'admin' informations", [
      () => agent.get('/api/account/admin')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'admin',
          email: 'admin@example.com',
          accessLevel: 'admin'
        })
    ]);

    test("should get forbidden response on special users", [
      () => agent.get('/api/account/super').expect(403)
    ]);

    test("should get notfound response on unknown users", [
      () => agent.get('/api/account/unknown').expect(404)
    ]);
  });

  as('super', function () {
    test("should get 'user2' informations", [
      () => agent.get('/api/account/user2')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'user2',
          email: 'user2@example.com',
          accessLevel: 'user'
        })
    ]);

    test("should get 'admin' informations", [
      () => agent.get('/api/account/admin')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'admin',
          email: 'admin@example.com',
          accessLevel: 'admin'
        })
    ]);

    test("should get 'super' informations", [
      () => agent.get('/api/account/super')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'super',
          email: 'su@example.com',
          accessLevel: 'su'
        })
    ]);

    test("should get notfound response on unknown users", [
      () => agent.get('/api/account/unknown').expect(404)
    ]);
  });
});

api("HEAD /api/account/:username", function (agent, test, as) {
  as('user', function () {
    test("should return 204 on self", [
      () => agent.head('/api/account/user').expect(204)
    ]);

    test("should return 404 with any other username", [
      () => agent.head('/api/account/user2').expect(404),
      () => agent.head('/api/account/super').expect(404),
      () => agent.head('/api/account/unknown').expect(404)
    ]);
  });
  
  as('admin', function () {
    test("should return 204 on self and other users", [
      () => agent.head('/api/account/user').expect(204),
      () => agent.head('/api/account/admin').expect(204),
      () => agent.head('/api/account/super').expect(204)
    ]);

    test("should return 404 on unknown users", [
      () => agent.head('/api/account/unknown').expect(404)
    ]);
  });
});

api("PUT /api/account/:username", function (agent, test, as) {
  as('user', function () {
    test("should update password on self", [
      () => agent.put('/api/account/user')
        .type('json')
        .send({ password: 'password123' })
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.com'
        }),
      () => agent.post('/api/login')
        .type('json')
        .send({ username: 'user', password: 'password123' })
        .expect(200),
      () => agent.get('/api/account/user')
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.com'
        })
    ]);

    test("should ignore accessLevel edit on self", [
      () => agent.put('/api/account/user')
        .type('json')
        .send({ accessLevel: 'admin' })
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.com'
        }),
      () => agent.get('/api/account/user')
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.com'
        })
    ]);

    test("should update email on self", [
      () => agent.put('/api/account/user')
        .type('json')
        .send({ email: 'user@example.net' })
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.net'
        }),
      () => agent.get('/api/account/user')
        .expect(200, {
          username: 'user',
          accessLevel: 'user',
          email: 'user@example.net'
        })
    ]);

    test("should return 403 on other users", [
      () => agent.put('/api/account/user2')
        .type('json')
        .send({ email: 'user2@example.net' })
        .expect(403)
    ]);

    test("should return 403 on unknown users", [
      () => agent.put('/api/account/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(403)
    ]);
  });

  as('admin', function () {
    test("should ignore accessLevel edit on self", [
      () => agent.put('/api/account/admin')
        .type('json')
        .send({ accessLevel: 'user' })
        .expect(200, {
          username: 'admin',
          accessLevel: 'admin',
          email: 'admin@example.com'
        }),
      () => agent.get('/api/account/admin')
        .expect(200, {
          username: 'admin',
          accessLevel: 'admin',
          email: 'admin@example.com'
        })
    ]);

    test("should update non-special users", [
      () => agent.put('/api/account/user2')
        .type('json')
        .send({ email: 'user2@example.net' })
        .expect(200, {
          username: 'user2',
          accessLevel: 'user',
          email: 'user2@example.net'
        }),
      () => agent.get('/api/account/user2')
        .expect(200, {
          username: 'user2',
          accessLevel: 'user',
          email: 'user2@example.net'
        })
    ]);

    test("should update accessLevel on non-special users", [
      () => agent.put('/api/account/user2')
        .type('json')
        .send({ accessLevel: 'admin' })
        .expect(200, {
          username: 'user2',
          accessLevel: 'admin',
          email: 'user2@example.net'
        }),
      () => agent.get('/api/account/user2')
        .expect(200, {
          username: 'user2',
          accessLevel: 'admin',
          email: 'user2@example.net'
        })
    ]);

    test("should return 400 with accessLevel higher than 'admin'", [
      () => agent.put('/api/account/user2')
        .type('json')
        .send({ accessLevel: 'special' })
        .expect(400)
    ]);

    test("should return 404 on unknown users", [
      () => agent.put('/api/account/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(404)
    ]);

    test("should return 403 on special users", [
      () => agent.put('/api/account/super')
        .type('json')
        .send({ email: 'super@example.net' })
        .expect(403)
    ]);
  });

  as('super', function () {
    test("should update self", [
      () => agent.put('/api/account/super')
        .type('json')
        .send({ email: 'super@example.net' })
        .expect(200, {
          username: 'super',
          accessLevel: 'su',
          email: 'super@example.net'
        }),
      () => agent.get('/api/account/super')
        .expect(200, {
          username: 'super',
          accessLevel: 'su',
          email: 'super@example.net'
        })
    ]);

    test("should return 400 with accessLevel higher than 'admin'", [
      () => agent.put('/api/account/user2')
        .type('json')
        .send({ accessLevel: 'special' })
        .expect(400)
    ]);

    test("should return 404 on unknown users", [
      () => agent.put('/api/account/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(404)
    ]);
  });
});

api("DELETE /api/account/:username", function (agent, test, as) {
  as('user', function () {
    test("should return 403 on any user", [
      () => agent.del('/api/account/user').expect(403),
      () => agent.del('/api/account/user2').expect(403),
      () => agent.del('/api/account/super').expect(403),
      () => agent.del('/api/account/unknown').expect(403)
    ]);
  });

  as('admin', function () {
    test("should delete non-special users", [
      () => agent.del('/api/account/user').expect(204)
    ]);

    test("should silently ignore unknown users", [
      () => agent.del('/api/account/unknown').expect(204)
    ]);

    test("should return 403 on self and special users", [
      () => agent.del('/api/account/admin').expect(403),
      () => agent.del('/api/account/super').expect(403)
    ]);
  });

  as('super', function () {
    test("should return 403 on self", [
      () => agent.del('/api/account/super').expect(403)
    ]);

    test("should delete other users", [
      () => agent.del('/api/account/user2').expect(204),
      () => agent.del('/api/account/admin').expect(204)
    ]);
  });
});


api("* /api/accounts", function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/accounts').expect(401),
    () => agent.post('/api/accounts').expect(401)
  ]);

  as('user', function () {
    test("should trigger 403 response", [
      () => agent.get('/api/accounts').expect(403),
      () => agent.post('/api/accounts')
        .type('json')
        .send({ username: 'shouldfail', password: 'test1234' })
        .expect(403)
    ]);
  });
});

api("GET /api/accounts", function (agent, test, as) {
  as('admin', function () {
    test("should get users grouped by access level", [
      () => agent.get('/api/accounts')
        .expect(200, {
          user: [
            {
              username: 'user',
              accessLevel: 'user',
              email: 'user@example.com'
            },
            {
              username: 'user2',
              accessLevel: 'user',
              email: 'user2@example.com'
            }
          ],
          admin: [
            {
              username: 'admin',
              accessLevel: 'admin',
              email: 'admin@example.com'
            }
          ]
        })
    ]);

    test("should get users with matching access level only", [
      () => agent.get('/api/accounts?accessLevel=user')
        .expect(200, {
          user: [
            {
              username: 'user',
              accessLevel: 'user',
              email: 'user@example.com'
            },
            {
              username: 'user2',
              accessLevel: 'user',
              email: 'user2@example.com'
            }
          ]
        })
    ]);

    test("should get user with matching email only", [
      () => agent.get('/api/accounts?email=admin@example.com')
        .expect(200, {
          admin: [
            {
              username: 'admin',
              accessLevel: 'admin',
              email: 'admin@example.com'
            }
          ],
          user: []
        })
    ]);
  });
});

api("POST /api/accounts", function (agent, test, as) {
  as('admin', function () {
    test("should create a new user with defaults on missing fields", [
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'newuser1',
          password: 'password123',
        }).expect(200, {
          username: 'newuser1',
          accessLevel: 'user',
          email: ''
        })
    ]);

    test("should create a new user with all provided fields", [
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'newuser2',
          accessLevel: 'admin',
          password: 'password123',
          email: 'newuser2@example.com'
        }).expect(200, {
          username: 'newuser2',
          accessLevel: 'admin',
          email: 'newuser2@example.com'
        })
    ]);

    test("should get 400 response with an invalid password", [
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'newuser3'
        }).expect(400),
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'newuser4',
          password: 'abc' // too short
        }).expect(400),
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'newuser5',
          password: 'password\n123' // illegal character
        }).expect(400)
    ]);

    test("should get 400 response with an invalid username", [
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          password: 'password123'
        }).expect(400),
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'a', // too short
          password: 'password123'
        }).expect(400),
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'user name', // illegal character
          password: 'password123'
        }).expect(400)
    ]);

    test("should return 409 response if user already exists", [
      () => agent.post('/api/accounts')
        .type('json')
        .send({
          username: 'user',
          password: 'password123'
        }).expect(409)
    ]);
  });
});
