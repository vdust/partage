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
  as('user', function () {
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
            accessList: {}
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
            accessList: {
              user: 'ro'
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
            accessList: {
              user: 'rw'
            }
          }
        ])
    ]);
  });
});

api("POST /api/repo/", function (agent, test, as) {
  as('user', function () {
    test("should get 403 (forbidden) response", [
      () => agent.post('/api/repo/')
        .send({ name: "test" })
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
            accessList: {}
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
        accessList: [ 'user', '+user2' ]
      }, 200, {
        accessList: {
          user: 'ro',
          user2: 'rw'
        }
      }),
      query({
        name: 'test-access String',
        accessList: 'user, +user2'
      }, 200, {
        accessList: {
          user: 'ro',
          user2: 'rw'
        }
      }),
      query({
        name: 'test-access Object',
        accessList: {
          user: 'ro',
          user2: 'rw'
        }
      }, 200, {
        accessList: {
          user: 'ro',
          user2: 'rw'
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
      query({ name: 'test-invalid-access3', accessList: { user: 'garbage' }}, 400)
    ]);
  });
});

api("GET /api/repo/stat", function (agent, test, as) {
  test("should get 401 (unauthorized) response if unauthenticated", [
    () => agent.get('/api/repo/stat?path=unknown').expect(401),
    () => agent.get('/api/repo/stat?path=readonly').expect(401)
  ]);

  as('user', function () {
    test("should get shared folder infos", [
      () => agent.get('/api/repo/stat?path=readonly')
        .expect('Content-Type', /json/)
        .expect(200, {
          name: 'readonly',
          uid: '2',
          description: 'Read-only folder',
          type: 'folder',
          mime: 'inode/directory',
          path: 'readonly',
          canread: true,
          canwrite: false,
          canedit: false
        }),
      () => agent.get('/api/repo/stat?path=readonly/')
        .expect('Content-Type', /json/)
        .expect(200, {
          name: 'readonly',
          uid: '2',
          description: 'Read-only folder',
          type: 'folder',
          mime: 'inode/directory',
          path: 'readonly',
          canread: true,
          canwrite: false,
          canedit: false
        })
    ]);

    test("should get subdirectory infos", [
      () => agent.get('/api/repo/stat?path=readonly/subdir/')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'subdir',
          uid: '2-37db6403631f80ea309d8b6c30580c1b73f4b8a9',
          path: 'readonly/subdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);

    test("should not require trailing slash on folder resource", [
      () => agent.get('/api/repo/stat?path=readonly/subdir')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'subdir',
          uid: '2-37db6403631f80ea309d8b6c30580c1b73f4b8a9',
          path: 'readonly/subdir',
          type: 'folder',
          mime: 'inode/directory'
        }),
    ]);

    test("should get file infos", [
      () => agent.get('/api/repo/stat?path=readonly/test.txt')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'test.txt',
          uid: '2-4b6fcb2d521ef0fd442a5301e7932d16cc9f375a',
          path: 'readonly/test.txt',
          type: 'file',
          mime: 'text/plain',
          mtime: (new Date('01-01-2016 00:00:00 GMT')).toJSON(),
          size: 4
        }),
    ]);

    test("should ignore trailing slash on file resource", [
      () => agent.get('/api/repo/stat?path=readonly/test.txt/')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'test.txt',
          uid: '2-4b6fcb2d521ef0fd442a5301e7932d16cc9f375a',
          path: 'readonly/test.txt',
          type: 'file',
          mime: 'text/plain',
          mtime: (new Date('01-01-2016 00:00:00 GMT')).toJSON(),
          size: 4
        }),
    ]);

    test("should get 404 response on missing resources", [
      () => agent.get('/api/repo/stat?path=unknown').expect(404),
      () => agent.get('/api/repo/stat?path=readonly/unknown').expect(404)
    ]);

    test("should get 404 response on folders with no read access", [
      () => agent.get('/api/repo/stat?path=adminonly').expect(404),
      () => agent.get('/api/repo/stat?path=adminonly/subdir').expect(404),
      () => agent.get('/api/repo/stat?path=adminonly/test.txt').expect(404),
      () => agent.get('/api/repo/stat?path=adminonly/unknown').expect(404)
    ]);
  });

  as('admin', function () {
    test("should get any shared folder infos with access list", [
      () => agent.get('/api/repo/stat?path=adminonly')
        .expect('Content-Type', /json/)
        .expect(200, {
          name: 'adminonly',
          uid: '1',
          description: '',
          type: 'folder',
          mime: 'inode/directory',
          path: 'adminonly',
          canread: true,
          canwrite: true,
          canedit: true,
          accessList: {}
        }),
      () => agent.get('/api/repo/stat?path=readonly')
        .expect('Content-Type', /json/)
        .expect(200, {
          name: 'readonly',
          uid: '2',
          description: 'Read-only folder',
          type: 'folder',
          mime: 'inode/directory',
          path: 'readonly',
          canread: true,
          canwrite: true,
          canedit: true,
          accessList: {
            user: 'ro'
          }
        })
    ]);

    test("should get any subdirectory infos", [
      () => agent.get('/api/repo/stat?path=adminonly/subdir')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'adminonly',
          dirname: '.',
          name: 'subdir',
          uid: '1-37db6403631f80ea309d8b6c30580c1b73f4b8a9',
          path: 'adminonly/subdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);

    test("should get any file infos", [
      () => agent.get('/api/repo/stat?path=adminonly/test.txt')
        .expect('Content-Type', /json/)
        .expect(200, {
          folder: 'adminonly',
          dirname: '.',
          name: 'test.txt',
          uid: '1-4b6fcb2d521ef0fd442a5301e7932d16cc9f375a',
          path: 'adminonly/test.txt',
          type: 'file',
          mime: 'text/plain',
          mtime: (new Date('01-01-2016 00:00:00 GMT')).toJSON(),
          size: 4
        })
    ]);

    test("should get 400 response with dotted names in path", [
      () => agent.get('/api/repo/stat?path=readonly/.fhconfig').expect(400),
      () => agent.get('/api/repo/stat?path=readonly/subdir/.unknown').expect(400),
      () => agent.get('/api/repo/stat?path=readonly/.unknown/unknown.txt').expect(400),
      () => agent.get('/api/repo/stat?path=.trash').expect(400)
    ]);
  });
});
