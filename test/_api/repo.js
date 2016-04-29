/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var api = require('./_common').api;
var merge = require('../../lib/utils').merge;

api("* /api/repo/", function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/repo/').expect(401),
    () => agent.post('/api/repo/').send({ name: "test" }).expect(401)
  ]);
});

api("GET /api/repo/", function (agent, test, as) {
  as('visitor', function () {
    test("should get list of readable shared folders", [
      () => agent.get('/api/repo/')
        .expect('Content-Type', /json/)
        .expect(200, [
          {
            name: 'readonly',
            uid: '2',
            description: 'Read-only folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readonly',
            canread: true,
            canwrite: false,
            canedit: false
          },
          {
            name: 'readwrite',
            uid: '3',
            description: 'Read-write folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readwrite',
            canread: true,
            canwrite: false,
            canedit: false
          }
        ])
    ]);
  });

  as('contrib', function () {
    test("should get list of readable and writable shared folders", [
      () => agent.get('/api/repo/')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, [
          {
            name: 'readonly',
            uid: '2',
            description: 'Read-only folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readonly',
            canread: true,
            canwrite: false,
            canedit: false
          },
          {
            name: 'readwrite',
            uid: '3',
            description: 'Read-write folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readwrite',
            canread: true,
            canwrite: true,
            canedit: false
          }
        ])
    ]);
  });

  as('admin', function () {
    test("should get list of all shared folders", [
      () => agent.get('/api/repo/')
        .set('Accept', 'application/json')
        .expect('Content-Type', /json/)
        .expect(200, [
          {
            name: 'adminonly',
            uid: '1',
            description: '',
            type: 'folder',
            mime: 'inode/directory',
            path: 'adminonly',
            canread: true,
            canwrite: true,
            canedit: true,
            access: {}
          },
          {
            name: 'readonly',
            uid: '2',
            description: 'Read-only folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readonly',
            canread: true,
            canwrite: true,
            canedit: true,
            access: {
              visitor: true,
              contrib: 'readonly'
            }
          },
          {
            name: 'readwrite',
            uid: '3',
            description: 'Read-write folder',
            type: 'folder',
            mime: 'inode/directory',
            path: 'readwrite',
            canread: true,
            canwrite: true,
            canedit: true,
            access: {
              visitor: true,
              contrib: true
            }
          }
        ])
    ]);
  });
});

api("POST /api/repo/", function (agent, test, as) {
  as('visitor', function () {
    test("should get 403 (forbidden) response", [
      () => agent.post('/api/repo/')
        .send({
          name: "test"
        })
        .expect(403)
    ]);
  });

  as('contrib', function () {
    test("should get 403 (forbidden) response", [
      () => agent.post('/api/repo/')
        .send({
          name: "test"
        })
        .expect(403)
    ]);
  });

  as('admin', function () {
    var uidseq = (function () {
      var last = 3;
      return function () {
        return ''+(++last);
      };
    })();

    function query(data, status, mergeBody) {
      return function () {
        var q = agent.post('/api/repo/')
          .set('Accept', 'application/json')
          .type('json')
          .send(data||{}).expect(status);

        if (data && status === 200) {
          q = q.expect(merge({
            name: data.name,
            uid: uidseq(),
            description: data.description||'',
            type: 'folder',
            mime: 'inode/directory',
            path: data.name,
            canread: true,
            canwrite: true,
            canedit: true,
            access: {}
          }, mergeBody||{}));
        }

        return q;
      };
    }

    test("should create shared folder with defaults", [
      query({ name: 'test-defaults'}, 200)
    ]);

    test("should create shared folder with description", [
      query({
        name: 'test-description',
        description: "testing description"
      }, 200)
    ]);

    test("should create shared folder with accessList", [
      query({
        name: 'test-access Array',
        accessList: [ 'visitor', '!contrib' ]
      }, 200, {
        access: {
          visitor: true,
          contrib: 'readonly'
        }
      }),
      query({
        name: 'test-access String',
        accessList: 'visitor, !contrib'
      }, 200, {
        access: {
          visitor: true,
          contrib: 'readonly'
        }
      }),
      query({
        name: 'test-access Object',
        accessList: {
          visitor: true,
          contrib: 'readonly'
        }
      }, 200, {
        access: {
          visitor: true,
          contrib: 'readonly'
        }
      })
    ]);

    test("should get 409 (conflict) response if folder already exists", [
      query({ name: 'readonly' }, 409)
    ]);

    test("should get 400 (bad request) response if name field is missing", [
      query({}, 400)
    ]);

    test("should get 400 (bad request) response if name field is invalid", [
      query({ name: '' }, 400),
      query({ name: 'invalid\nname' }, 400),
      query({ name: '.dotted-name' }, 400)
    ]);

    test("should get 400 (bad request) response if accessList is invalid", [
      query({ name: 'test-invalid-access1', accessList: 42 }, 400),
      query({ name: 'test-invalid-access2', accessList: 'not a valid user' }, 400),
      query({ name: 'test-invalid-access3', accessList: { visitor: 'garbage' }}, 400)
    ]);
  });
});
