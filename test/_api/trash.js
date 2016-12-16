/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

'use strict';

var pathJoin = require('path').join;

var expect = require('expect');

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
    'readwrite/',
    'readwrite/trashed/',
    'readwrite/trashed.txt',
    'adminonly/trashed/',
    'adminonly/trashed.txt',
    'deleted/',
    'deleted/trashed/',
    'deleted/trashed.txt'
  ]
};

var apiEditOpts = {
  trash: apiOpts.trash,
  edit: true
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
          trashInfos('folder', 'deleted'),
          trashInfos('folder', 'readwrite'),
          trashInfos('folder', 'adminonly', 'trashed', 'adminonly'),
          trashInfos('folder', 'deleted', 'trashed', 'deleted'),
          trashInfos('folder', 'readonly', 'trashed', 'readonly'),
          trashInfos('folder', 'readwrite', 'trashed', 'readwrite'),
          trashInfos('file', 'adminonly', 'trashed.txt', 'adminonly'),
          trashInfos('file', 'deleted', 'trashed.txt', 'deleted'),
          trashInfos('file', 'readonly', 'trashed.txt', 'readonly'),
          trashInfos('file', 'readwrite', 'trashed.txt', 'readwrite')
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
          trashInfos('folder', 'deleted'),
          trashInfos('folder', 'readwrite'),
          trashInfos('folder', 'adminonly', 'trashed', 'adminonly'),
          trashInfos('folder', 'deleted', 'trashed', 'deleted'),
          trashInfos('folder', 'readonly', 'trashed', 'readonly'),
          trashInfos('file', 'adminonly', 'trashed.txt', 'adminonly'),
          trashInfos('file', 'deleted', 'trashed.txt', 'deleted'),
          trashInfos('file', 'readonly', 'trashed.txt', 'readonly'),
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

api('* /api/trash/:uid', function (agent, test, as) {
  test("should get 401 response if unauthenticated", [
    () => agent.get('/api/trash/'+uid('readwrite/trashed.txt')).expect(401),
    () => agent.del('/api/trash/'+uid('readwrite/trashed.txt')).expect(401)
  ]);

  test("should get 400 response on invalid uid", [
    () => agent.get('/api/trash/notAValidId=').expect(400),
    () => agent.get('/api/trash/not-A+ValidId').expect(400)
  ]);
});

api('GET /api/trash/:uid', apiOpts, function (agent, test, as) {
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

api('DELETE /api/trash/:uid', apiOpts, function (agent, test, as) {
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

api('POST /api/trash/:uid/restore', apiEditOpts, function (agent, test, as) {
  function restore(path, isDir) {
    var uri = '/api/trash/'+uid(path, isDir)+'/restore';
    return agent.post(uri);
  }

  function checkRestored(replaced, path, contain) {
    if (typeof replaced === 'string') {
      contain = path;
      path = replaced;
      replaced = false;
    }

    var isDir = path.substr(-1) === '/';
    path = path.replace(/\/$/, '');
    var sp = path.split('/');
    var name = sp.pop();
    var folder = sp.shift();
    var dir = sp.join('/') || '.';

    return function (res) {
      var data = folder ? {
        folder: folder,
        dirname: dir,
        name: name,
        path: path,
        type: isDir ? 'folder' : 'file'
      } : {
        name: name,
        description: '',
        type: 'folder',
        mime: 'inode/directory',
        canread: true,
        canwrite: true
      };

      expect(res.body)
        .toBeAn('object')
        .toContain(data);

      if (contain) expect(res.body).toContain(contain);

      if (replaced) {
        expect(res.body.replaced)
          .toContain({ origin: path })
          .toContainKey('itemUid');
      }
    };
  }

  test("should get 401 response if unauthorized", [
    () => restore('readwrite/trashed.txt').expect(401),
    () => restore('readwrite/trashed', true).expect(401)
  ]);

  as('user', function () {
    test("should restore file to its origin location", [
      () => restore('readwrite/trashed.txt')
        .expect(200)
        .expect(checkRestored('readwrite/trashed.txt')),
      () => agent.head('/api/repo/readwrite/trashed.txt').expect(204),
      () => agent.delPath('readwrite/trashed.txt')
    ]);

    test("should restore directory to its origin location", [
      () => restore('readwrite/trashed', true)
        .expect(200)
        .expect(checkRestored('readwrite/trashed/')),
      () => agent.head('/api/repo/readwrite/trashed/').expect(204),
      () => agent.delPath('readwrite/trashed/')
    ]);

    test("should restore file to the specified location", [
      () => restore('readwrite/trashed.txt')
        .send({ path: 'readwrite/restored.txt' })
        .expect(200)
        .expect(checkRestored('readwrite/restored.txt')),
      () => agent.head('/api/repo/readwrite/restored.txt').expect(204),
      () => agent.delPath('readwrite/restored.txt')
    ]);

    test("should restore directory to the specified location", [
      () => restore('readwrite/trashed', true)
        .send({ path: 'readwrite/restored' })
        .expect(200)
        .expect(checkRestored('readwrite/restored/')),
      () => agent.head('/api/repo/readwrite/restored/').expect(204),
      () => agent.delPath('readwrite/restored/')
    ]);

    test("should rename restored file if origin exists", [
      () => restore('readwrite/trashed.txt')
        .send({ path: 'readwrite/exist.txt' })
        .expect(200)
        .expect(checkRestored('readwrite/[#1] exist.txt')),
      () => agent.head('/api/repo/readwrite/[%231] exist.txt').expect(204),
      () => agent.delPath('readwrite/[#1] exist.txt')
    ]);

    test("should rename restored directory if origin exists", [
      () => restore('readwrite/trashed', true)
        .send({ path: 'readwrite/existdir' })
        .expect(200)
        .expect(checkRestored('readwrite/[#1] existdir/')),
      () => agent.head('/api/repo/readwrite/[%231] existdir/').expect(204),
      () => agent.delPath('readwrite/[#1] existdir/')
    ]);

    test("should handle rename conflicts on files with incremental prefix", [
      () => agent.putFile('readwrite/restored.txt'),
      () => agent.putFile('readwrite/[#1] restored.txt'),
      () => agent.putFile('readwrite/[#3] restored.txt'),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored.txt'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#2] restored.txt')),
      () => agent.head('/api/repo/readwrite/[%232] restored.txt').expect(204),
      () => agent.delPath('readwrite/restored.txt'),
      () => agent.delPath('readwrite/[#1] restored.txt'),
      () => agent.delPath('readwrite/[#2] restored.txt'),
      () => agent.delPath('readwrite/[#3] restored.txt')
    ]);

    test("should handle rename conflicts on directories with incremental prefix", [
      () => agent.putDir('readwrite/restored/'),
      () => agent.putDir('readwrite/[#1] restored/'),
      () => agent.putDir('readwrite/[#3] restored/'),
      () => restore('readwrite/trashed', true)
        .send({
          path: 'readwrite/restored'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#2] restored/')),
      () => agent.head('/api/repo/readwrite/[%232] restored/').expect(204),
      () => agent.delPath('readwrite/restored/'),
      () => agent.delPath('readwrite/[#1] restored/'),
      () => agent.delPath('readwrite/[#2] restored/'),
      () => agent.delPath('readwrite/[#3] restored/')
    ]);

    test("should detect file name prefix and increment it on conflicts", [
      () => agent.putFile('readwrite/[#1] restored.txt'),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/[#1] restored.txt'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#2] restored.txt')),
      () => agent.head('/api/repo/readwrite/[%232] restored.txt').expect(204),
      () => agent.delPath('readwrite/[#1] restored.txt'),
      () => agent.delPath('readwrite/[#2] restored.txt')
    ]);

    test("should detect directory name prefix and increment it on conflicts", [
      () => agent.putDir('readwrite/[#1] restored/'),
      () => restore('readwrite/trashed', true)
        .send({
          path: 'readwrite/[#1] restored'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#2] restored/')),
      () => agent.head('/api/repo/readwrite/[%232] restored/').expect(204),
      () => agent.delPath('readwrite/[#1] restored/'),
      () => agent.delPath('readwrite/[#2] restored/')
    ]);

    test("should handle rename conflicts type-insensitively", [
      () => agent.putFile('readwrite/restored'),
      () => agent.putDir('readwrite/[#1] restored/'),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#2] restored')),
      () => restore('readwrite/trashed', true)
        .send({
          path: 'readwrite/[#1] restored'
        })
        .expect(200)
        .expect(checkRestored('readwrite/[#3] restored/')),
      () => agent.delPath('readwrite/restored'),
      () => agent.delPath('readwrite/[#1] restored/'),
      () => agent.delPath('readwrite/[#2] restored'),
      () => agent.delPath('readwrite/[#3] restored/')
    ]);

    test("should replace existing file when restoring file to same location", [
      () => agent.putFile('readwrite/restored.txt'),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored.txt',
          replace: true
        })
        .expect(200)
        .expect(checkRestored('readwrite/restored.txt')),
      () => agent.head('/api/repo/readwrite/restored.txt').expect(204),
      () => agent.delPath('readwrite/restored.txt')
    ]);

    test("should replace existing directory when restoring file to same location", [
      () => agent.putDir('readwrite/restored/'),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored',
          replace: true
        })
        .expect(200)
        .expect(checkRestored('readwrite/restored')),
      () => agent.head('/api/repo/readwrite/restored').expect(204),
      () => agent.delPath('readwrite/restored')
    ]);

    test("should replace existing directory when restoring directory to same location", [
      () => agent.putDir('readwrite/restored/'),
      () => restore('readwrite/trashed', true)
        .send({
          path: 'readwrite/restored',
          replace: true
        })
        .expect(200)
        .expect(checkRestored('readwrite/restored/')),
      () => agent.head('/api/repo/readwrite/restored/').expect(204),
      () => agent.delPath('readwrite/restored/'),
    ]);

    test("should replace existing file when restoring directory to same location", [
      () => agent.putFile('readwrite/restored'),
      () => restore('readwrite/trashed', true)
        .send({
          path: 'readwrite/restored',
          replace: true
        })
        .expect(200)
        .expect(checkRestored('readwrite/restored/')),
      () => agent.head('/api/repo/readwrite/restored/').expect(204),
      () => agent.delPath('readwrite/restored/')
    ]);

    test("should create missing (non-root) parents in targeted path", [
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored/restored.txt',
          parents: true
        })
        .expect(200)
        .expect(checkRestored('readwrite/restored/restored.txt')),
      () => agent.head('/api/repo/readwrite/restored/restored.txt').expect(204),
      () => agent.delPath('readwrite/restored/')
    ]);

    test("should get 400 response if explicit path is invalid", [
      () => restore('readwrite/trashed.txt')
        .send({ path: 'readwrite/invalid\npath.txt' })
        .expect(400),
      () => restore('readwrite/trashed.txt')
        .send({ path: 'readwrite/.dotted' })
        .expect(400)
    ]);

    test("should get 404 response if missing parents and 'parents' flag is false", [
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'readwrite/restored/restored.txt'
        })
        .expect(404)
    ]);

    test("should get 404 response if origin shared folder is not writable", [
      () => restore('readonly/trashed.txt').expect(404)
    ]);

    test("should get 404 response if no access to origin shared folder", [
      () => restore('adminonly/trashed.txt').expect(404)
    ]);

    test("should get 404 response if origin shared folder is missing", [
      () => restore('deleted/trashed.txt').expect(404)
    ]);

    test("should get 404 response if trashed shared folder has name of a writable one", [
      () => restore('readwrite', true).expect(404)
    ]);

    test("should get 404 response if itemUid doesn't exist", [
      () => restore('unknown/trashed.txt').expect(404)
    ]);

    test("should get 409 response if origin exists and 'rename' flag is false", [
      () => restore('readwrite/trashed.txt').send({
        path: 'readwrite/exist.txt',
        rename: false
      }).expect(409)
    ]);

    test("should get 409 response if an element in origin path is not a directory", [
      () => restore('readwrite/trashed.txt').send({
        path: 'readwrite/exist.txt/restored.txt'
      }).expect(409)
    ]);
  });

  as('admin', function () {
    test("should restore any non-root resource to any location in an existing folder", [
      () => restore('readonly/trashed.txt')
        .expect(200)
        .expect(checkRestored('readonly/trashed.txt')),
      () => restore('readwrite/trashed.txt')
        .send({
          path: 'adminonly/restored.txt'
        })
        .expect(200)
        .expect(checkRestored('adminonly/restored.txt')),
      () => agent.delPath('readonly/trashed.txt'),
      () => agent.delPath('adminonly/restored.txt')
    ]);

    test("should restore shared folder", [
      () => restore('deleted', true)
        .expect(200)
        .expect(checkRestored('deleted/')),
      () => agent.head('/api/repo/deleted/').expect(204),
      () => agent.delPath('deleted/')
    ]);

    test("should rename restored shared folder if origin exists", [
      () => restore('readwrite', true)
        .expect(200)
        .expect(checkRestored('[#1] readwrite/')),
      () => agent.head('/api/repo/[%231] readwrite/').expect(204),
      () => agent.delPath('[#1] readwrite/')
    ]);

    test("should get 404 response if restoring resource to a non-existing shared folder", [
      () => restore('readwrite/trashed.txt')
        .send({ path: 'unknown/restored.txt' })
        .expect(404),
      () => restore('readwrite/trashed.txt')
        .send({ path: 'unknown/subdir/restored.txt', parents: 1 })
        .expect(404)
    ]);

    test("should get 409 response if shared folder already exists and 'rename' is false", [
      () => restore('deleted', true)
        .send({ path: 'readonly', rename: false })
        .expect(409)
    ]);

    test("should get 409 response when restoring a subdirectory as a shared folder", [
      () => restore('readwrite/trashed', true)
        .send({ path: 'restored' })
        .expect(409)
    ]);

    test("should get 409 response if shared folder targets a subdirectory", [
      () => restore('deleted', true)
        .send({ path: 'readwrite/restored' })
        .expect(409)
    ]);
  });
});
