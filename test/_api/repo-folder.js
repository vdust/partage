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

api("* /api/repo/:folder/", function (agent, test, as) {
  test("should get 404 response if trailing slash is missing", [
    () => agent.get('/api/repo/readwrite').expect(404),
    () => agent.head('/api/repo/readwrite').expect(404),
    () => agent.put('/api/repo/readwrite').expect(404),
    () => agent.del('/api/repo/readwrite').expect(404)
  ]);

  test("should get 401 (unauthorized) response if unauthenticated", [
    () => agent.get('/api/repo/readwrite/').expect(401),
    () => agent.head('/api/repo/readwrite/').expect(401),
    () => agent.put('/api/repo/readwrite/').expect(401),
    () => agent.del('/api/repo/readwrite/').expect(401),
  ]);

  test("should get 400 response on illegal folder names", [
    () => agent.get('/api/repo/.trash/').expect(400),
    () => agent.get('/api/repo/illegal\nname/').expect(400),
    () => agent.head('/api/repo/.trash/').expect(400),
    () => agent.head('/api/repo/illegal\nname/').expect(400),
    () => agent.put('/api/repo/.trash/').expect(400),
    () => agent.put('/api/repo/illegal\nname/').expect(400),
    () => agent.del('/api/repo/.trash/').expect(400),
    () => agent.del('/api/repo/illegal\nname/').expect(400)
  ]);
});

api("GET /api/repo/:folder/", function (agent, test, as) {
  as('user', function () {
    test("should get folder infos, files and subdirectories", [
      () => agent.get('/api/repo/readonly/')
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
          canedit: false,
          dirs: [
            {
              folder: 'readonly',
              dirname: '.',
              name: 'subdir',
              uid: Resource.pathHash('readonly/subdir'),
              path: 'readonly/subdir',
              type: 'folder',
              mime: 'inode/directory'
            }
          ],
          files: [
            {
              folder: 'readonly',
              dirname: '.',
              name: 'test.txt',
              uid: Resource.pathHash('readonly/test.txt'),
              path: 'readonly/test.txt',
              type: 'file',
              mime: 'text/plain',
              mtime: (new Date('01-01-2016 00:00:00 GMT')).toJSON(),
              size: 4
            }
          ]
        })
    ]);

    test("should get folder infos and full subdirectories tree", [
      () => agent.get('/api/repo/readonly/')
        .query({ tree: 1 })
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
          canedit: false,
          dirs: [
            {
              folder: 'readonly',
              dirname: '.',
              name: 'subdir',
              uid: Resource.pathHash('readonly/subdir'),
              path: 'readonly/subdir',
              type: 'folder',
              mime: 'inode/directory',
              dirs: [
                {
                  folder: 'readonly',
                  dirname: 'subdir',
                  name: 'recursive',
                  uid: Resource.pathHash('readonly/subdir/recursive'),
                  path: 'readonly/subdir/recursive',
                  type: 'folder',
                  mime: 'inode/directory',
                  dirs: []
                }
              ]
            }
          ]
        })
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.get('/api/repo/adminonly/').expect(404)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.get('/api/repo/unknown/').expect(404)
    ]);

    test("should get 400 response on illegal folder names", [
      () => agent.get('/api/repo/.trash/').expect(400),
      () => agent.get('/api/repo/illegal\nname/').expect(400)
    ]);
  });

  as('admin', function () {
    test("should get infos on any folder", [
      () => agent.get('/api/repo/adminonly/')
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
          accessList: {},
          dirs: [
            {
              folder: 'adminonly',
              dirname: '.',
              name: 'subdir',
              uid: Resource.pathHash('adminonly/subdir'),
              path: 'adminonly/subdir',
              type: 'folder',
              mime: 'inode/directory'
            }
          ],
          files: [
            {
              folder: 'adminonly',
              dirname: '.',
              name: 'test.txt',
              uid: Resource.pathHash('adminonly/test.txt'),
              path: 'adminonly/test.txt',
              type: 'file',
              mime: 'text/plain',
              mtime: (new Date('01-01-2016 00:00:00 GMT')).toJSON(),
              size: 4
            }
          ]
        })
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.get('/api/repo/unknown/').expect(404)
    ]);
  });
});

api("HEAD /api/repo/:folder/", function (agent, test, as) {
  as('user', function () {
    test("should get 204 response on folder with read access", [
      () => agent.head('/api/repo/readonly/').expect(204)
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.head('/api/repo/adminonly/').expect(404)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.head('/api/repo/unknown/').expect(404)
    ]);
  });

  as('admin', function () {
    test("should get 204 response on any existing folder", [
      () => agent.head('/api/repo/adminonly/').expect(204)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.head('/api/repo/unknown/').expect(404)
    ]);
  });
});

api("PUT /api/repo/:folder/", function (agent, test, as) {
  as('user', function () {
    test("should get 403 response on any folder", [
      () => agent.put('/api/repo/readonly/')
        .send({
          description: "untouched"
        }).expect(403),
      () => agent.put('/api/repo/readwrite/')
        .send({
          description: "untouched"
        }).expect(403),
      () => agent.put('/api/repo/adminonly/')
        .send({
          description: "untouched"
        }).expect(403),
      () => agent.put('/api/repo/unknown/')
        .send({
          description: "untouched"
        }).expect(403)
    ]);
  });

  as('admin', function () {
    var infos = {
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
    };

    test("should update description only", [
      () => agent.put('/api/repo/adminonly/')
        .send({
          description: "admin"
        })
        .expect(cleanTime)
        .expect(200, merge({}, infos, { description: 'admin' })),
      () => agent.get('/api/repo/stat?path=adminonly')
        .expect(cleanTime)
        .expect(200, merge({}, infos, { description: 'admin' })),
      () => agent.put('/api/repo/adminonly/')
        .send({
          description: ""
        })
        .expect(cleanTime)
        .expect(200, infos)
    ]);

    test("should update access only", [
      () => agent.put('/api/repo/adminonly/')
        .send({
          accessList: [ 'user', '+user2' ]
        })
        .expect(cleanTime)
        .expect(200, merge({}, infos, {
          accessList: { user: 'ro', user2: 'rw' }
        })),
      () => agent.get('/api/repo/stat?path=adminonly')
        .expect(cleanTime)
        .expect(200, merge({}, infos, {
          accessList: { user: 'ro', user2: 'rw' }
        })),
      () => agent.put('/api/repo/adminonly/')
        .send({
          accessList: {}
        })
        .expect(cleanTime)
        .expect(200, infos)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.put('/api/repo/unknown/')
        .send({ description: "" }).expect(404)
    ]);
  });
});

api("DELETE /api/repo/folder/", function (agent, test, as) {
  as('user', function () {
    test("should get 403 response on any folder", [
      () => agent.del('/api/repo/readonly/').expect(403),
      () => agent.del('/api/repo/readwrite/').expect(403),
      () => agent.del('/api/repo/adminonly/').expect(403),
      () => agent.del('/api/repo/unknown/').expect(403)
    ]);
  });

  as('admin', function () {
    var trashUid;
    test("should move folder to trash", [
      () => agent.del('/api/repo/readonly/')
        .expect(200)
        .type('json')
        .expect(function (res) {
          expect(res.body).toContain({
            origin: 'readonly'
          });
          expect(res.body).toContainKey('trashUid');
        })
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.del('/api/repo/unknown/').expect(404)
    ]);
  });
});
