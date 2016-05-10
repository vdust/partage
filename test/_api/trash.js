/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var pathJoin = require('path').join;

var api = require('./_common').api;
var buildUid = require('../../lib/manager/trash').buildUid;

var date = new Date('2016-01-01 00:00:00 GMT');

function trashInfos(type, folder, name, origin) {
  return {
    uid: buildUid(type === 'folder', date, pathJoin(origin||folder, name||'')),
    name: name || folder,
    type: type,
    mime: type === 'folder' ? 'inode/directory' : 'text/plain',
    timestamp: date.getTime(),
    folder: folder,
    isFolder: !name,
    origin: origin || ''
  };
}

function uid(path, isDir) {
  return buildUid(!!isDir, date, path);
}

var apiOpts = {
  trash: [
    'readonly/trashed/',
    'readonly/trashed.txt',
    'readwrite/trashed/',
    'readwrite/trashed.txt',
    'adminonly/trashed/',
    'adminonly/trashed.txt',
    'deleted/',
    'deleted/trashed/',
    'deleted/trashed.txt'
  ]
};

api('* /api/trash', function (agent, test, as) {
  test("should trigger 401 response if unauthenticated", [
    () => agent.get('/api/trash').expect(401),
    () => agent.del('/api/trash').expect(401)
  ]);
});

api('GET /api/trash', apiOpts, function (agent, test, as) {
  as('user', function () {
    test("should get trashed items from readwrite folder only", [
      () => agent.get('/api/trash')
        .expect(200, [
          trashInfos('folder', 'readwrite', 'trashed', 'readwrite'),
          trashInfos('file', 'readwrite', 'trashed.txt', 'readwrite')
        ])
    ]);
  });

  as('admin', function () {
    test("should get all trashed items", [
      () => agent.get('/api/trash')
        .expect(200, [
          trashInfos('folder', 'adminonly', 'trashed', 'adminonly'),
          trashInfos('folder', 'readonly', 'trashed', 'readonly'),
          trashInfos('folder', 'readwrite', 'trashed', 'readwrite'),
          trashInfos('folder', 'deleted', 'trashed', 'deleted'),
          trashInfos('file', 'adminonly', 'trashed.txt', 'adminonly'),
          trashInfos('file', 'readonly', 'trashed.txt', 'readonly'),
          trashInfos('file', 'readwrite', 'trashed.txt', 'readwrite'),
          trashInfos('file', 'deleted', 'trashed.txt', 'deleted'),
          trashInfos('folder', 'deleted')
        ])
    ]);
  });
});

api('DELETE /api/trash', apiOpts, function (agent, test, as) {
  as('user', function () {
    test("should delete all trashed files with write access", [
      () => agent.del('/api/trash').expect(204),
      () => agent.post('/api/login')
        .send({ username: 'admin', password: 'test' }).expect(200),
      () => agent.get('/api/trash')
        .expect(200, [
          trashInfos('folder', 'adminonly', 'trashed', 'adminonly'),
          trashInfos('folder', 'readonly', 'trashed', 'readonly'),
          trashInfos('folder', 'deleted', 'trashed', 'deleted'),
          trashInfos('file', 'adminonly', 'trashed.txt', 'adminonly'),
          trashInfos('file', 'readonly', 'trashed.txt', 'readonly'),
          trashInfos('file', 'deleted', 'trashed.txt', 'deleted'),
          trashInfos('folder', 'deleted')
        ])
    ]);
  });

  as('admin', function ()  {
    test("should delete all trashed files", [
      () => agent.del('/api/trash').expect(204),
      () => agent.get('/api/trash').expect(200, [])
    ]);
  });
});

api('* /api/trash/:itemId', function (agent, test, as) {
  test("should get 401 response if unauthenticated", [
    () => agent.get('/api/trash/'+uid('readwrite/trashed.txt')).expect(401),
    () => agent.del('/api/trash/'+uid('readwrite/trashed.txt')).expect(401)
  ]);

  test("should get 400 response on invalid uid", [
    () => agent.get('/api/trash/notAValidId=').expect(400),
    () => agent.get('/api/trash/not-A+ValidId').expect(400)
  ]);
});

api('GET /api/trash/:itemId', apiOpts, function (agent, test, as) {
  as('user', function () {
    test("should get trashed file infos", [
      () => agent.get('/api/trash/'+uid('readwrite/trashed.txt'))
        .expect(200, {
          uid: uid('readwrite/trashed.txt'),
          name: 'trashed.txt',
          type: 'file',
          mime: 'text/plain',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'readwrite',
          isFolder: false,
          origin: 'readwrite'
        })
    ]);

    test("should get trashed directory infos", [
      () => agent.get('/api/trash/'+uid('readwrite/trashed', true))
        .expect(200, {
          uid: uid('readwrite/trashed', true),
          name: 'trashed',
          type: 'folder',
          mime: 'inode/directory',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'readwrite',
          isFolder: false,
          origin: 'readwrite'
        })
    ]);

    test("should get 404 response with items from non writable folders", [
      () => agent.get('/api/trash/'+uid('readonly/trashed.txt')).expect(404),
      () => agent.get('/api/trash/'+uid('readonly/trashed', true)).expect(404),
      () => agent.get('/api/trash/'+uid('adminonly/trashed.txt')).expect(404),
    ]);

    test("should get 404 response with items in deleted folders", [
      () => agent.get('/api/trash/'+uid('deleted', true)).expect(404),
      () => agent.get('/api/trash/'+uid('deleted/trashed.txt')).expect(404)
    ]);

    test("should get 404 response on non existing item", [
      () => agent.get('/api/trash/'+uid('readwrite/unknown.txt')).expect(404),
      () => agent.get('/api/trash/'+uid('readwrite/unknown', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown/trashed', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown/trashed.txt')).expect(404)
    ]);
  });

  as('admin', function () {
    test("should get any trashed file infos", [
      () => agent.get('/api/trash/'+uid('adminonly/trashed.txt'))
        .expect(200, {
          uid: uid('adminonly/trashed.txt'),
          name: 'trashed.txt',
          type: 'file',
          mime: 'text/plain',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'adminonly',
          isFolder: false,
          origin: 'adminonly'
        }),
      () => agent.get('/api/trash/'+uid('deleted/trashed.txt'))
        .expect(200, {
          uid: uid('deleted/trashed.txt'),
          name: 'trashed.txt',
          type: 'file',
          mime: 'text/plain',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'deleted',
          isFolder: false,
          origin: 'deleted'
        })
    ]);

    test("should get any trashed directory infos", [
      () => agent.get('/api/trash/'+uid('adminonly/trashed', true))
        .expect(200, {
          uid: uid('adminonly/trashed', true),
          name: 'trashed',
          type: 'folder',
          mime: 'inode/directory',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'adminonly',
          isFolder: false,
          origin: 'adminonly'
        }),
      () => agent.get('/api/trash/'+uid('deleted/trashed', true))
        .expect(200, {
          uid: uid('deleted/trashed', true),
          name: 'trashed',
          type: 'folder',
          mime: 'inode/directory',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'deleted',
          isFolder: false,
          origin: 'deleted'
        })
    ]);

    test("should get trashed folder infos", [
      () => agent.get('/api/trash/'+uid('deleted', true))
        .expect(200, {
          uid: uid('deleted', true),
          name: 'deleted',
          type: 'folder',
          mime: 'inode/directory',
          timestamp: (new Date('2016-01-01 00:00:00 GMT')).getTime(),
          folder: 'deleted',
          isFolder: true,
          origin: ''
        })
    ]);

    test("should get 404 response on non existing item", [
      () => agent.get('/api/trash/'+uid('readwrite/unknown.txt')).expect(404),
      () => agent.get('/api/trash/'+uid('readwrite/unknown', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown/trashed', true)).expect(404),
      () => agent.get('/api/trash/'+uid('unknown/trashed.txt')).expect(404)
    ]);
  });
});

api('DELETE /api/trash/:itemId', apiOpts, function (agent, test, as) {
  as('user', function () {
    test("should delete trashed file", [
      () => agent.del('/api/trash/'+uid('readwrite/trashed.txt')).expect(204),
      () => agent.get('/api/trash')
        .expect(200, [
          trashInfos('folder', 'readwrite', 'trashed', 'readwrite'),
        ])
    ]);

    test("should delete trashed directory", [
      () => agent.del('/api/trash/'+uid('readwrite/trashed', true)).expect(204),
      () => agent.get('/api/trash')
        .expect(200, [
          trashInfos('file', 'readwrite', 'trashed.txt', 'readwrite')
        ])
    ]);

    test("should get 404 response on trashed resource from readonly folder", [
      () => agent.del('/api/trash/'+uid('readonly/trashed.txt')).expect(404),
      () => agent.del('/api/trash/'+uid('readonly/trashed', true)).expect(404)
    ]);

    test("should get 404 response on trashed resource from non-readable folder", [
      () => agent.del('/api/trash/'+uid('adminonly/trashed.txt')).expect(404),
      () => agent.del('/api/trash/'+uid('adminonly/trashed', true)).expect(404)
    ]);

    test("should get 404 response on trashed folder or resource from deleted folder", [
      () => agent.del('/api/trash/'+uid('deleted', true)).expect(404),
      () => agent.del('/api/trash/'+uid('deleted/trashed', true)).expect(404),
      () => agent.del('/api/trash/'+uid('deleted/trashed.txt')).expect(404)
    ]);

    test("should silently ignore non existing uid if origin is from writable folder", [
      () => agent.del('/api/trash/'+uid('readwrite/notfound.txt')).expect(204),
      () => agent.del('/api/trash/'+uid('readwrite/notfound', true)).expect(204)
    ]);

    test("should get 404 response on non existing trashed resource from non writable", [
      () => agent.del('/api/trash/'+uid('readonly/notfound.txt')).expect(404),
      () => agent.del('/api/trash/'+uid('readonly/notfound', true)).expect(404),
      () => agent.del('/api/trash/'+uid('not/found.txt', true)).expect(404),
      () => agent.del('/api/trash/'+uid('not/found')).expect(404)
    ]);

    test("should get 404 response on forged uid with absolute path", [
      () => agent.del('/api/trash/'+uid('/not/a/valid/path.txt')).expect(404)
    ]);
  });

  as('admin', function () {
    test("should delete trashed resource from adminonly folder", [
      () => agent.del('/api/trash/'+uid('adminonly/trashed.txt')).expect(204),
      () => agent.del('/api/trash/'+uid('adminonly/trashed', true)).expect(204)
    ]);

    test("should delete trashed resource from deleted folder", [
      () => agent.del('/api/trash/'+uid('deleted/trashed.txt')).expect(204),
      () => agent.del('/api/trash/'+uid('deleted/trashed', true)).expect(204)
    ]);

    test("should delete trashed folder", [
      () => agent.del('/api/trash/'+uid('deleted')).expect(204)
    ]);
  });
});

api('POST /api/trash/:itemId/restore', function (agent, test, as) {
  test("TODO");
});
