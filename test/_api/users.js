/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var api = require('./_common').api;

api("* /api/user/:username", function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/user/visitor').expect(401),
    () => agent.get('/api/user/unknown').expect(401),
    () => agent.head('/api/user/visitor').expect(401),
    () => agent.head('/api/user/unknown').expect(401),
    () => agent.put('/api/user/visitor').expect(401),
    () => agent.put('/api/user/unknown').expect(401),
    () => agent.del('/api/user/visitor').expect(401),
    () => agent.del('/api/user/unknown').expect(401)
  ]);
});

api("GET /api/user/:username", function (agent, test, as) {
  as('visitor', function () {
    test("should get 'visitor' informations", [
      () => agent.get('/api/user/visitor')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'visitor',
          email: 'visitor@example.com',
          accessLevel: 'visitor'
        })
    ]);

    test("should get forbidden response on other users", [
      () => agent.get('/api/user/admin').expect(403)
    ]);

    test("should get forbidden response on unknown users", [
      () => agent.get('/api/user/unknown').expect(403)
    ]);
  });

  as('admin', function () {
    test("should get 'visitor' informations", [
      () => agent.get('/api/user/visitor')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'visitor',
          email: 'visitor@example.com',
          accessLevel: 'visitor'
        })
    ]);

    test("should get 'admin' informations", [
      () => agent.get('/api/user/admin')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'admin',
          email: 'admin@example.com',
          accessLevel: 'admin'
        })
    ]);

    test("should get forbidden response on special users", [
      () => agent.get('/api/user/super').expect(403)
    ]);

    test("should get notfound response on unknown users", [
      () => agent.get('/api/user/unknown').expect(404)
    ]);
  });

  as('super', function () {
    test("should get 'visitor' informations", [
      () => agent.get('/api/user/visitor')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'visitor',
          email: 'visitor@example.com',
          accessLevel: 'visitor'
        })
    ]);

    test("should get 'admin' informations", [
      () => agent.get('/api/user/admin')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'admin',
          email: 'admin@example.com',
          accessLevel: 'admin'
        })
    ]);

    test("should get 'super' informations", [
      () => agent.get('/api/user/super')
        .expect('Content-Type', /json/)
        .expect(200, {
          username: 'super',
          email: 'su@example.com',
          accessLevel: 'su'
        })
    ]);

    test("should get notfound response on unknown users", [
      () => agent.get('/api/user/unknown').expect(404)
    ]);
  });
});

api("HEAD /api/user/:username", function (agent, test, as) {
  as('visitor', function () {
    test("should return 204 on self", [
      () => agent.head('/api/user/visitor').expect(204)
    ]);

    test("should return 404 with any other username", [
      () => agent.head('/api/user/admin').expect(404),
      () => agent.head('/api/user/unknown').expect(404)
    ]);
  });
  
  as('admin', function () {
    test("should return 204 on self and other users", [
      () => agent.head('/api/user/visitor').expect(204),
      () => agent.head('/api/user/admin').expect(204),
      () => agent.head('/api/user/super').expect(204)
    ]);

    test("should return 404 on unknown users", [
      () => agent.head('/api/user/unknown').expect(404)
    ]);
  });
});

api("PUT /api/user/:username", function (agent, test, as) {
  as('visitor', function () {
    test("should update password on self", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ password: 'password123' })
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.com'
        }),
      () => agent.post('/api/login')
        .type('json')
        .send({ username: 'visitor', password: 'password123' })
        .expect(200),
      () => agent.get('/api/user/visitor')
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.com'
        })
    ]);

    test("should ignore accessLevel edit on self", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ accessLevel: 'contributor' })
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.com'
        }),
      () => agent.get('/api/user/visitor')
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.com'
        })
    ]);

    test("should update email on self", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ email: 'visitor@example.net' })
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.net'
        }),
      () => agent.get('/api/user/visitor')
        .expect(200, {
          username: 'visitor',
          accessLevel: 'visitor',
          email: 'visitor@example.net'
        })
    ]);

    test("should return 403 on other users", [
      () => agent.put('/api/user/contrib')
        .type('json')
        .send({ email: 'contrib@example.net' })
        .expect(403)
    ]);

    test("should return 403 on unknown users", [
      () => agent.put('/api/user/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(403)
    ]);
  });

  as('admin', function () {
    test("should ignore accessLevel edit on self", [
      () => agent.put('/api/user/admin')
        .type('json')
        .send({ accessLevel: 'contributor' })
        .expect(200, {
          username: 'admin',
          accessLevel: 'admin',
          email: 'admin@example.com'
        }),
      () => agent.get('/api/user/admin')
        .expect(200, {
          username: 'admin',
          accessLevel: 'admin',
          email: 'admin@example.com'
        })
    ]);

    test("should update non-special users", [
      () => agent.put('/api/user/contrib')
        .type('json')
        .send({ email: 'contrib@example.net' })
        .expect(200, {
          username: 'contrib',
          accessLevel: 'contributor',
          email: 'contrib@example.net'
        }),
      () => agent.get('/api/user/contrib')
        .expect(200, {
          username: 'contrib',
          accessLevel: 'contributor',
          email: 'contrib@example.net'
        })
    ]);

    test("should update accessLevel on non-special users", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ accessLevel: 'admin' })
        .expect(200, {
          username: 'visitor',
          accessLevel: 'admin',
          email: 'visitor@example.net'
        }),
      () => agent.get('/api/user/visitor')
        .expect(200, {
          username: 'visitor',
          accessLevel: 'admin',
          email: 'visitor@example.net'
        })
    ]);

    test("should return 400 with accessLevel higher than 'admin'", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ accessLevel: 'special' })
        .expect(400)
    ]);

    test("should return 404 on unknown users", [
      () => agent.put('/api/user/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(404)
    ]);

    test("should return 403 on special users", [
      () => agent.put('/api/user/super')
        .type('json')
        .send({ email: 'super@example.net' })
        .expect(403)
    ]);
  });

  as('super', function () {
    test("should update self", [
      () => agent.put('/api/user/super')
        .type('json')
        .send({ email: 'super@example.net' })
        .expect(200, {
          username: 'super',
          accessLevel: 'su',
          email: 'super@example.net'
        }),
      () => agent.get('/api/user/super')
        .expect(200, {
          username: 'super',
          accessLevel: 'su',
          email: 'super@example.net'
        })
    ]);

    test("should return 400 with accessLevel higher than 'admin'", [
      () => agent.put('/api/user/visitor')
        .type('json')
        .send({ accessLevel: 'special' })
        .expect(400)
    ]);

    test("should return 404 on unknown users", [
      () => agent.put('/api/user/unknown')
        .type('json')
        .send({ email: 'unknown@example.net' })
        .expect(404)
    ]);
  });
});

api("DELETE /api/user/:username", function (agent, test, as) {
  as('visitor', function () {
    test("should return 403 on any user", [
      () => agent.del('/api/user/visitor').expect(403),
      () => agent.del('/api/user/admin').expect(403),
      () => agent.del('/api/user/unknown').expect(403)
    ]);
  });

  as('admin', function () {
    test("should silently ignore unknown users", [
      () => agent.del('/api/user/unknown').expect(204)
    ]);

    test("should return 403 on self and special users", [
      () => agent.del('/api/user/admin').expect(403),
      () => agent.del('/api/user/super').expect(403)
    ]);

    test("should delete non-special users", [
      () => agent.del('/api/user/visitor').expect(204)
    ]);
  });

  as('super', function () {
    test("should return 403 on self", [
      () => agent.del('/api/user/super').expect(403)
    ]);

    test("should delete other users", [
      () => agent.del('/api/user/contrib').expect(204),
      () => agent.del('/api/user/admin').expect(204)
    ]);
  });
});


api("* /api/users", function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/users').expect(401),
    () => agent.post('/api/users').expect(401)
  ]);

  as('contrib', function () {
    test("should trigger 403 response", [
      () => agent.get('/api/users').expect(403),
      () => agent.post('/api/users')
        .type('json')
        .send({ username: 'shouldfail', password: 'test1234' })
        .expect(403)
    ]);
  });
});

api("GET /api/users", function (agent, test, as) {
  as('admin', function () {
    test("should get users grouped by access level", [
      () => agent.get('/api/users')
        .expect(200, {
          visitor: [
            {
              username: 'visitor',
              accessLevel: 'visitor',
              email: 'visitor@example.com'
            }
          ],
          contributor: [
            {
              username: 'contrib',
              accessLevel: 'contributor',
              email: 'contrib@example.com'
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
      () => agent.get('/api/users?accessLevel=visitor')
        .expect(200, {
          visitor: [
            {
              username: 'visitor',
              accessLevel: 'visitor',
              email: 'visitor@example.com'
            }
          ],
        })
    ]);

    test("should get user with matching email only", [
      () => agent.get('/api/users?email=admin@example.com')
        .expect(200, {
          admin: [
            {
              username: 'admin',
              accessLevel: 'admin',
              email: 'admin@example.com'
            }
          ],
          contributor: [],
          visitor: []
        })
    ]);
  });
});

api("POST /api/users", function (agent, test, as) {
  as('admin', function () {
    test("should create a new user with defaults on missing fields", [
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'newuser1',
          password: 'password123',
        }).expect(200, {
          username: 'newuser1',
          accessLevel: 'visitor',
          email: ''
        })
    ]);
    test("should create a new user with all provided fields", [
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'newuser2',
          accessLevel: 'contributor',
          password: 'password123',
          email: 'newuser2@example.com'
        }).expect(200, {
          username: 'newuser2',
          accessLevel: 'contributor',
          email: 'newuser2@example.com'
        })
    ]);

    test("should fail to create user with an invalid password", [
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'newuser3'
        }).expect(400),
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'newuser4',
          password: 'abc' // too short
        }).expect(400),
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'newuser5',
          password: 'password\n123' // illegal character
        }).expect(400)
    ]);

    test("should fail to create user with an invalid username", [
      () => agent.post('/api/users')
        .type('json')
        .send({
          password: 'password123'
        }).expect(400),
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'a', // too short
          password: 'password123'
        }).expect(400),
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'user name', // illegal character
          password: 'password123'
        }).expect(400)
    ]);

    test("should return 409 (conflict) if user already exists", [
      () => agent.post('/api/users')
        .type('json')
        .send({
          username: 'visitor',
          password: 'password123'
        }).expect(409)
    ]);
  });
});
