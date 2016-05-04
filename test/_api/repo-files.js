/*!
 *
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

'use strict';

var expect = require('expect');

var api = require('./_common').api;


api("* /api/repo/:folder/path+", function (agent, test, as) {
  test("should get 401 (unauthorized) response if unauthenticated", [
    () => agent.get('/api/repo/adminonly/test.txt').expect(401),
    () => agent.head('/api/repo/adminonly/test.txt').expect(401),
    () => agent.put('/api/repo/adminonly/test.txt').expect(401),
    () => agent.del('/api/repo/adminonly/test.txt').expect(401)
  ]);

  test("should get 400 response on files with illegal characters in path", [
    () => agent.get('/api/repo/.trash/target.txt').expect(400),
    () => agent.get('/api/repo/illegal\nname/target.txt').expect(400),
    () => agent.get('/api/repo/readwrite/.fhconfig').expect(400),
    () => agent.get('/api/repo/readwrite/illegal\nname.txt').expect(400),
    () => agent.head('/api/repo/.trash/target.txt').expect(400),
    () => agent.head('/api/repo/illegal\nname/target.txt').expect(400),
    () => agent.head('/api/repo/readwrite/.fhconfig').expect(400),
    () => agent.head('/api/repo/readwrite/illegal\nname.txt').expect(400),
    () => agent.put('/api/repo/.trash/target.txt').expect(400),
    () => agent.put('/api/repo/illegal\nname/target.txt').expect(400),
    () => agent.put('/api/repo/readwrite/.fhconfig').expect(400),
    () => agent.put('/api/repo/readwrite/illegal\nname.txt').expect(400),
    () => agent.del('/api/repo/.trash/target.txt').expect(400),
    () => agent.del('/api/repo/illegal\nname/target.txt').expect(400),
    () => agent.del('/api/repo/readwrite/.fhconfig').expect(400),
    () => agent.del('/api/repo/readwrite/illegal\nname.txt').expect(400)
  ]);
});

function queryFile(agent, path, contents, type) {
  return () => agent.get('/api/repo'+path)
    .expect(200)
    .expect('Content-Length', contents.length)
    .expect(function (res) {
      expect(res.type).toBe(type || 'text/plain');
      expect(res.text).toBe(contents);
    });
}

api("GET /api/repo/:folder/path+", function (agent, test, as) {
  as('visitor', function () {
    test("should get file contents", [
      queryFile(agent, '/readonly/test.txt', "test")
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.get('/api/repo/unknown/target.txt').expect(404)
    ]);

    test("should get 404 response on folders with no access", [
      () => agent.get('/api/repo/adminonly/test.txt').expect(404)
    ]);

    test("should get 404 response on unknown files", [
      () => agent.get('/api/repo/readwrite/unknown').expect(404)
    ]);

    test("should get 409 response if target is a directory (no trailing slash)", [
      () => agent.get('/api/repo/readonly/subdir').expect(409)
    ]);

    test("should get 409 response if target parent is a file", [
      () => agent.get('/api/repo/readonly/test.txt/target').expect(409)
    ]);
  });
});

api("HEAD /api/repo/:folder/path+", function (agent, test, as) {
  as('visitor', function () {
    test("should get 204 response", [
      () => agent.head('/api/repo/readonly/test.txt').expect(204)
    ]);

    test("should get 404 response on unknown folder", [
      () => agent.head('/api/repo/unknown/target.txt').expect(404)
    ]);

    test("should get 404 response on folders with no access", [
      () => agent.head('/api/repo/adminonly/test.txt').expect(404)
    ]);

    test("should get 404 response on unknown files", [
      () => agent.head('/api/repo/readwrite/unknown.txt').expect(404)
    ]);

    test("should get 409 response if target is a directory (no trailing slash)", [
      () => agent.head('/api/repo/readonly/subdir').expect(409)
    ]);

    test("should get 409 response if target parent is a file", [
      () => agent.head('/api/repo/readonly/test.txt/target').expect(409)
    ]);
  });
});

api("PUT /api/repo/:folder/path+", function (agent, test, as) {
  as('visitor', function () {
    test("should get 403 response on any attempt to send a file", [
      () => agent.put('/api/repo/readwrite/forbidden.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('epic fail')
        .expect(403),
      () => agent.put('/api/repo/adminonly/forbidden.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send('epic fail')
        .expect(403)
    ]);
  });

  as('contrib', function () {
    test("should write a new file", [
      () => agent.put('/api/repo/readwrite/new.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("New file")
        .expect(200)
        .expect(function (res) {
          expect(res.body).toContain({
            folder: 'readwrite',
            dirname: '.',
            name: 'new.txt',
            uid: '3-71ddebcf9d25aab7c0849b3a96a5804f16d21bd6',
            path: 'readwrite/new.txt',
            type: 'file',
            mime: 'text/plain',
            size: 8
          });
          expect(res.body).toNotContainKey('replaced');
        }),
      queryFile(agent, '/readwrite/new.txt', "New file")
    ]);

    test("should replace existing file", [
      () => agent.put('/api/repo/readwrite/replace.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("To be replaced").expect(200),
      () => agent.put('/api/repo/readwrite/replace.txt')
        .query({ replace: 1 })
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Replaced").expect(200)
        .expect(function (res) {
          expect(res.body).toContain({
            folder: 'readwrite',
            dirname: '.',
            name: 'replace.txt',
            uid: '3-5e0e3b0db2344111e3eb830122ac4fb0c973ddd9',
            path: 'readwrite/replace.txt',
            type: 'file',
            mime: 'text/plain',
            size: 8
          });
          expect(res.body).toContain({
            replaced: { origin: 'readwrite/replace.txt' }
          });
        }),
      queryFile(agent, '/readwrite/replace.txt', "Replaced")
    ]);

    test("should get 403 response on read-only folder", [
      () => agent.put('/api/repo/readonly/new.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Read only").expect(403)
    ]);

    test("should get 404 response on non existing folder", [
      () => agent.put('/api/repo/unknown/test.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Missing folder").expect(404)
    ]);

    test("should get 404 response if parent directory doesn't exist", [
      () => agent.put('/api/repo/readwrite/unknown/test.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Missing subdir").expect(404)
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.put('/api/repo/adminonly/new.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("No access").expect(404)
    ]);

    test("should get 409 response if file already exists", [
      () => agent.put('/api/repo/readwrite/exist.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Already exist").expect(409),
      queryFile(agent, '/readwrite/exist.txt', "test")
    ]);

    test("should get 409 response if parent is an existing file", [
      () => agent.put('/api/repo/readwrite/exist.txt/new.txt')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Parent is not a directory").expect(409)
    ]);

    test("should get 409 response if target to replace is a directory", [
      () => agent.put('/api/repo/readwrite/existdir')
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Is directory").expect(409)
    ]);
  });
});

api("DELETE /api/repo/:folder/path+", function (agent, test, as) {
  as('visitor', function () {
    test("should get 403 response on any attempt", [
      () => agent.del('/api/repo/readwrite/exist.txt').expect(403),
      () => agent.del('/api/repo/adminonly/test.txt').expect(403),
      () => agent.del('/api/repo/unknown/test.txt').expect(403)
    ]);
  });

  as('contrib', function () {
    function trashItemPayload(res) {
      expect(res.body).toContain({
        origin: 'readwrite/garbage.txt'
      });
      expect(res.body).toContainKey('trashUid');
    }

    test("should send file to trash", [
      () => agent.put('/api/repo/readwrite/garbage.txt')
        .query({ replace: 1 })
        .set('Content-Type', 'text/plain; charset=utf-8')
        .send("Garbage").expect(200),
      () => agent.del('/api/repo/readwrite/garbage.txt')
        .expect(200)
        .expect(trashItemPayload)
    ]);

    test("should get 403 response on read-only folder", [
      () => agent.del('/api/repo/readonly/test.txt').expect(403)
    ]);

    test("should get 404 response if target doesn't exist", [
      () => agent.del('/api/repo/readwrite/unknown/test.txt').expect(404),
      () => agent.del('/api/repo/readwrite/existdir/unknown.txt').expect(404)
    ]);

    test("should get 404 response on non existing folder", [
      () => agent.del('/api/repo/unknown/test.txt').expect(404)
    ]);

    test("should get 404 response on folder with no access", [
      () => agent.del('/api/repo/adminonly/test.txt').expect(404)
    ]);

    test("should get 409 response if parent is an existing file", [
      () => agent.del('/api/repo/readwrite/exist.txt/target.txt').expect(409)
    ]);

    test("should get 409 response if the target is a directory (no trailing slash)", [
      () => agent.del('/api/repo/readwrite/existdir').expect(409)
    ]);
  });
});
