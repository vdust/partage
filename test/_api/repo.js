/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var expect = require('expect');

var api = require('./_common').api;
var cleanTime = require('./_common').cleanTime;
var merge = require('../../lib/utils').merge;
var Resource = require('../../lib/manager/resource');

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
            uid: Resource.pathHash('readonly'),
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
            uid: Resource.pathHash('readwrite'),
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
            uid: Resource.pathHash('adminonly'),
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
            uid: Resource.pathHash('readonly'),
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
            uid: Resource.pathHash('readwrite'),
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
    function query(data, status, mergeBody) {
      return function () {
        var q = agent.post('/api/repo/')
          .set('Accept', 'application/json')
          .type('json')
          .send(data||{}).expect(status);

        if (data && status === 200) {
          q = q.expect(merge({
            name: data.name,
            uid: Resource.pathHash(data.name),
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
        .expect(cleanTime)
        .expect(200, {
          name: 'readonly',
          uid: Resource.pathHash('readonly'),
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
        .expect(cleanTime)
        .expect(200, {
          name: 'readonly',
          uid: Resource.pathHash('readonly'),
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
        .expect(cleanTime)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'subdir',
          uid: Resource.pathHash('readonly/subdir'),
          path: 'readonly/subdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);

    test("should not require trailing slash on folder resource", [
      () => agent.get('/api/repo/stat?path=readonly/subdir')
        .expect('Content-Type', /json/)
        .expect(cleanTime)
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'subdir',
          uid: Resource.pathHash('readonly/subdir'),
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
          uid: Resource.pathHash('readonly/test.txt'),
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
          uid: Resource.pathHash('readonly/test.txt'),
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
        .expect(cleanTime)
        .expect(200, {
          name: 'adminonly',
          uid: Resource.pathHash('adminonly'),
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
        .expect(cleanTime)
        .expect(200, {
          name: 'readonly',
          uid: Resource.pathHash('readonly'),
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
        .expect(cleanTime)
        .expect(200, {
          folder: 'adminonly',
          dirname: '.',
          name: 'subdir',
          uid: Resource.pathHash('adminonly/subdir'),
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
          uid: Resource.pathHash('adminonly/test.txt'),
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

api("POST /api/repo/rename", { edit: true}, function (agent, test, as) {
  test("should get 401 response if unauthorized", [
    () => agent.post('/api/repo/rename')
      .send({
        src: 'readwrite/test.txt',
        dest: 'readwrite/test2.txt'
      })
      .expect(401)
  ]);

  as('user', function () {
    test("should rename file", [
      () => agent.putFile('readwrite/to-rename.txt'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt',
          dest: 'readwrite/renamed.txt'
        })
        .expect(200)
        .expect(function (res) {
          expect(res.body).toBeAn('object');
          expect(res.body).toContain({
            dirname: '.',
            folder: 'readwrite',
            mime: 'text/plain',
            name: 'renamed.txt',
            path: 'readwrite/renamed.txt',
            type: 'file',
            uid: Resource.pathHash('readwrite/renamed.txt')
          });
          expect(res.body).toContainKey('mtime');
        }),
      () => agent.delPath('readwrite/renamed.txt')
    ]);

    test("should rename file and move it to another location", [
      () => agent.putFile('readwrite/to-move.txt'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-move.txt',
          dest: 'readwrite/existdir/moved.txt'
        })
        .expect(200)
        .expect(function (res) {
          expect(res.body).toBeAn('object');
          expect(res.body).toContain({
            dirname: 'existdir',
            folder: 'readwrite',
            mime: 'text/plain',
            name: 'moved.txt',
            path: 'readwrite/existdir/moved.txt',
            type: 'file',
            uid: Resource.pathHash('readwrite/existdir/moved.txt')
          });
          expect(res.body).toContainKey('mtime');
        }),
      () => agent.delPath('readwrite/existdir/moved.txt')
    ]);

    test("should rename directory", [
      () => agent.putDir('readwrite/to-rename/'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename',
          dest: 'readwrite/renamed'
        })
        .expect(cleanTime)
        .expect(200, {
          dirname: '.',
          folder: 'readwrite',
          mime: 'inode/directory',
          name: 'renamed',
          path: 'readwrite/renamed',
          type: 'folder',
          uid: Resource.pathHash('readwrite/renamed')
        }),
      () => agent.delPath('readwrite/renamed/')
    ]);

    test("should rename file and replace existing target", [
      () => agent.putFile('readwrite/to-rename.txt'),
      () => agent.putFile('readwrite/replace.txt'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt',
          dest: 'readwrite/replace.txt',
          replace: 1
        })
        .expect(200)
        .expect(function (res) {
          expect(res.body).toBeAn('object');
          expect(res.body).toContain({
            dirname: '.',
            folder: 'readwrite',
            mime: 'text/plain',
            name: 'replace.txt',
            path: 'readwrite/replace.txt',
            type: 'file',
            uid: Resource.pathHash('readwrite/replace.txt'),
            replaced: {
              origin: 'readwrite/replace.txt'
            }
          });
          expect(res.body).toContainKey('mtime');
          expect(res.body.replaced).toContainKey('itemUid');
        }),
      () => agent.delPath('readwrite/replace.txt')
    ]);

    test("should rename directory and replace existing target", [
      () => agent.putDir('readwrite/to-rename/'),
      () => agent.putDir('readwrite/replace/'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename',
          dest: 'readwrite/replace',
          replace: 1
        })
        .expect(200)
        .expect(function (res) {
          expect(res.body).toBeAn('object');
          expect(res.body).toContain({
            dirname: '.',
            folder: 'readwrite',
            mime: 'inode/directory',
            name: 'replace',
            path: 'readwrite/replace',
            type: 'folder',
            uid: Resource.pathHash('readwrite/replace'),
            replaced: {
              origin: 'readwrite/replace'
            }
          });
          expect(res.body.replaced).toContainKey('itemUid');
        }),
      () => agent.delPath('readwrite/replace/')
    ]);

    test("should succeed and return file infos if src and dest are the same", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/exist.txt',
          dest: 'readwrite/exist.txt'
        })
        .expect(200)
        .expect(function (res) {
          expect(res.body).toBeAn('object');
          expect(res.body).toContain({
            dirname: '.',
            folder: 'readwrite',
            mime: 'text/plain',
            name: 'exist.txt',
            path: 'readwrite/exist.txt',
            type: 'file',
            uid: Resource.pathHash('readwrite/exist.txt'),
          });
          expect(res.body).toContainKey('mtime');
        })
    ]);

    test("should get 400 response if src is missing in body", [
      () => agent.post('/api/repo/rename')
        .send({
          dest: 'readwrite/renamed.txt'
        })
        .expect(400)
    ]);

    test("should get 400 response if dest is missing in body", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt'
        })
        .expect(400)
    ]);

    test("should get 400 response if src or dest are invalid path", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/invalid\nname.txt',
          dest: 'readwrite/renamed.txt'
        })
        .expect(400),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/.fhconfig',
          dest: 'readwrite/renamed.txt'
        })
        .expect(400),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt',
          dest: 'readwrite/invalid\nname.txt'
        })
        .expect(400),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt',
          dest: 'readwrite/.fhconfig'
        })
        .expect(400)
    ]);

    test("should get 403 response when renaming a shared folder", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite',
          dest: 'renamed'
        })
        .expect(403)
    ]);

    test("should get 403 response if the source is readable but not writable", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readonly/test.txt',
          dest: 'readwrite/renamed.txt'
        })
        .expect(403)
    ]);

    test("should get 403 response if the target shared folder is not writable", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/test.txt',
          dest: 'readonly/renamed.txt'
        })
        .expect(403),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/test.txt',
          dest: 'adminonly/renamed.txt'
        })
        .expect(403),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/test.txt',
          dest: 'unknown/renamed.txt'
        })
        .expect(403)
    ]);

    test("should get 404 response if src file is missing", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/unknown.txt',
          dest: 'readwrite/renamed.txt'
        })
        .expect(404)
    ]);

    test("should get 404 response if the parent of the target doesn't exist", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/exist.txt',
          dest: 'readwrite/unknown/renamed.txt'
        })
        .expect(404)
    ]);

    test("should get 409 response if the target exists and the 'replace' flag isn't set", [
      () => agent.putFile('readwrite/to-replace.txt'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-replace.txt',
          dest: 'readwrite/exist.txt'
        })
        .expect(409),
      () => agent.delPath('readwrite/to-replace.txt')
    ]);

    test("should get 409 response if the target is in the source directory", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/existdir',
          dest: 'readwrite/existdir/fail'
        })
        .expect(409)
    ]);

    test("should get 409 response if source is a sub-directory of target", [
      () => agent.putDir('readwrite/renamed/to-rename/'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/renamed/to-rename',
          dest: 'readwrite/renamed'
        })
        .expect(409),
      () => agent.delPath('readwrite/renamed/')
    ]);

    test("should get 409 response if the parent of the source is a file", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/exist.txt/source.txt',
          dest: 'readwrite/renamed.txt'
        })
        .expect(409)
    ]);

    test("should get 409 response if the parent of the target is a file", [
      () => agent.putFile('readwrite/to-rename.txt'),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/to-rename.txt',
          dest: 'readwrite/exist.txt/renamed.txt'
        })
        .expect(409),
      () => agent.delPath('readwrite/to-rename.txt')
    ]);
  });

  as('admin', function () {
    test("should rename a shared folder", [
      () => agent.post('/api/repo/').send({ name: 'to-rename' }).expect(200),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'to-rename',
          dest: 'renamed'
        })
        .expect(200)
        .expect(function (res) {
          delete res.body.mtime;
          expect(res.body).toContainKey('uid');
          delete res.body.uid;
        })
        .expect({
          name: 'renamed',
          path: 'renamed',
          type: 'folder',
          mime: 'inode/directory',
          description: '',
          accessList: {},
          canread: true,
          canwrite: true,
          canedit: true
        }),
      () => agent.delPath('renamed/')
    ]);

    test("should rename a shared folder, replacing existing target", [
      () => agent.post('/api/repo/').send({ name: 'to-rename' }).expect(200),
      () => agent.post('/api/repo/').send({ name: 'to-replace' }).expect(200),
      () => agent.post('/api/repo/rename')
        .send({
          src: 'to-rename',
          dest: 'to-replace',
          replace: 1
        })
        .expect(200)
        .expect(function (res) {
          delete res.body.mtime;
          expect(res.body).toContainKey('uid');
          delete res.body.uid;
          expect(res.body.replaced).toContainKey('itemUid');
          delete res.body.replaced.itemUid;
        })
        .expect({
          name: 'to-replace',
          path: 'to-replace',
          type: 'folder',
          mime: 'inode/directory',
          description: '',
          accessList: {},
          canread: true,
          canwrite: true,
          canedit: true,
          replaced: {
            origin: 'to-replace'
          }
        }),
      () => agent.delPath('to-replace/')
    ]);

    test("should get 409 response if any path is a shared folder and the other isn't", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite',
          dest: 'adminonly/renamed'
        })
        .expect(409)
    ]);

    test("should get 404 response if source shared folder doesn't exist", [
      () => agent.post('/api/repo/rename')
        .send({
          src: 'readwrite/existdir',
          dest: 'renamed'
        })
        .expect(409)
    ]);
  });
});
