/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var expect = require('expect');

var api = require('./_common').api;

api("* /api/repo/:folder/path+/", function (agent, test, as) {
  test("should get 401 (unauthorized) response if unauthenticated", [
    () => agent.get('/api/repo/readonly/subdir/').expect(401),
    () => agent.head('/api/repo/readonly/subdir/').expect(401),
    () => agent.put('/api/repo/readonly/subdir/').expect(401),
    () => agent.del('/api/repo/readonly/subdir/').expect(401)
  ]);

  test("should get 400 response on files with illegal characters in path", [
    () => agent.get('/api/repo/.trash/target/').expect(400),
    () => agent.get('/api/repo/illegal\nname/target/').expect(400),
    () => agent.get('/api/repo/readwrite/.fhconfig/').expect(400),
    () => agent.get('/api/repo/readwrite/illegal\nname/').expect(400),
    () => agent.head('/api/repo/.trash/target/').expect(400),
    () => agent.head('/api/repo/illegal\nname/target/').expect(400),
    () => agent.head('/api/repo/readwrite/.fhconfig/').expect(400),
    () => agent.head('/api/repo/readwrite/illegal\nname/').expect(400),
    () => agent.put('/api/repo/.trash/target/').expect(400),
    () => agent.put('/api/repo/illegal\nname/target/').expect(400),
    () => agent.put('/api/repo/readwrite/.fhconfig/').expect(400),
    () => agent.put('/api/repo/readwrite/illegal\nname/').expect(400),
    () => agent.del('/api/repo/.trash/target/').expect(400),
    () => agent.del('/api/repo/illegal\nname/target/').expect(400),
    () => agent.del('/api/repo/readwrite/.fhconfig/').expect(400),
    () => agent.del('/api/repo/readwrite/illegal\nname/').expect(400)
  ]);
});

api("GET /api/repo/:folder/path+/", function (agent, test, as) {
  as('user', function () {
    test("should get directory infos with files and subdirectories", [
      () => agent.get('/api/repo/readonly/subdir/')
        .expect(200, {
          folder: 'readonly',
          dirname: '.',
          name: 'subdir',
          uid: '2-37db6403631f80ea309d8b6c30580c1b73f4b8a9',
          path: 'readonly/subdir',
          type: 'folder',
          mime: 'inode/directory',
          dirs: [],
          files: []
        })
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.get('/api/repo/unknown/subdir/').expect(404)
    ]);

    test("should get 404 response on folders with no access", [
      () => agent.get('/api/repo/adminonly/subdir/').expect(404)
    ]);

    test("should get 404 response on unknown files", [
      () => agent.get('/api/repo/readwrite/unknown/').expect(404)
    ]);

    test("should get 409 response if target is a file (extra trailing slash)", [
      () => agent.get('/api/repo/readonly/test.txt/').expect(409)
    ]);

    test("should get 409 response if target parent is a file", [
      () => agent.get('/api/repo/readonly/test.txt/target/').expect(409)
    ]);
  });
});

api("HEAD /api/repo/:folder/path+/", function (agent, test, as) {
  as('user', function () {
    test("should get 204 response", [
      () => agent.head('/api/repo/readonly/subdir/').expect(204)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.head('/api/repo/unknown/target/').expect(404)
    ]);

    test("should get 404 response on folders with no access", [
      () => agent.head('/api/repo/adminonly/subdir/').expect(404)
    ]);

    test("should get 404 response on unknown files", [
      () => agent.head('/api/repo/readwrite/unknown/').expect(404)
    ]);

    test("should get 409 response if target is a file (extra trailing slash)", [
      () => agent.head('/api/repo/readonly/test.txt/').expect(409)
    ]);

    test("should get 409 response if target parent is a file", [
      () => agent.head('/api/repo/readonly/test.txt/target/').expect(409)
    ]);
  });
});

api("PUT /api/repo/:folder/path+/", function (agent, test, as) {
  as('user', function () {
    test("should create a new directory", [
      () => agent.put('/api/repo/readwrite/newdir/')
        .expect(200, {
          folder: 'readwrite',
          dirname: '.',
          name: 'newdir',
          uid: '3-475e437cbb1da01a8ccf52ef3b1192c5bac9f165',
          path: 'readwrite/newdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);
    
    test("should create a new directory with missing parents", [
      () => agent.put('/api/repo/readwrite/newparent/newdir/')
        .query({ parents: 1 })
        .expect(200, {
          folder: 'readwrite',
          dirname: 'newparent',
          name: 'newdir',
          uid: '3-70ecb6e21cbb726bb8ba76e43a7a71783775e289',
          path: 'readwrite/newparent/newdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);

    test("should succeed if directory already exists", [
      () => agent.put('/api/repo/readwrite/existdir/')
        .expect(200, {
          folder: 'readwrite',
          dirname: '.',
          name: 'existdir',
          uid: '3-2786e35ff1796c2d7b9a1d4851ac245f6e481989',
          path: 'readwrite/existdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);

    test("should get 403 response on read-only folder", [
      () => agent.put('/api/repo/readonly/newparent/newdir/')
        .query({ parents: 1 })
        .expect(403)
    ]);

    test("should get 404 response on missing parent", [
      () => agent.put('/api/repo/readwrite/unknown/newdir/').expect(404)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.put('/api/repo/unknown/newparent/newdir/')
        .query({ parents: 1 })
        .expect(404)
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.put('/api/repo/adminonly/newparent/newdir/')
        .query({ parents: 1 })
        .expect(404)
    ]);

    test("should get 409 response if the target is a file", [
      () => agent.put('/api/repo/readwrite/exist.txt/').expect(409)
    ]);

    test("should get 409 response if parent is a file", [
      () => agent.put('/api/repo/readwrite/exist.txt/newdir/').expect(409)
    ]);
  });

  as('admin', function () {
    test("should create a new directory in any folder", [
      () => agent.put('/api/repo/adminonly/newdir/')
        .expect(200, {
          folder: 'adminonly',
          dirname: '.',
          name: 'newdir',
          uid: '1-475e437cbb1da01a8ccf52ef3b1192c5bac9f165',
          path: 'adminonly/newdir',
          type: 'folder',
          mime: 'inode/directory'
        })
    ]);
  });
});

api("DELETE /api/repo/:folder/path+/", function (agent, test, as) {
  as('user', function () {
    function trashItemPayload(res) {
      expect(res.body).toContain({
        origin: 'readwrite/garbage'
      });
      expect(res.body).toContainKey('trashUid');
    }

    test("should send file to trash", [
      () => agent.put('/api/repo/readwrite/garbage/').expect(200),
      () => agent.del('/api/repo/readwrite/garbage/')
        .expect(200)
        .expect(trashItemPayload)
    ]);

    test("should get 403 response on read-only folder", [
      () => agent.del('/api/repo/readonly/subdir/').expect(403)
    ]);

    test("should get 404 response if target doesn't exist", [
      () => agent.del('/api/repo/readwrite/unknown/target/').expect(404),
      () => agent.del('/api/repo/readwrite/existdir/unknown/').expect(404)
    ]);

    test("should get 404 response on non existing folder", [
      () => agent.del('/api/repo/unknown/subdir/').expect(404)
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.del('/api/repo/adminonly/subdir/').expect(404)
    ]);

    test("should get 409 response if parent is an existing file", [
      () => agent.del('/api/repo/readwrite/exist.txt/target/').expect(409)
    ]);

    test("should get 409 response if the target is a file (extra trailing slash)", [
      () => agent.del('/api/repo/readwrite/exist.txt/').expect(409)
    ]);
  });
});
