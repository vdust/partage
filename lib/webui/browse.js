/*
 * Copyright (c) 2016 Raphaël Bois Rousseau
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software  and associated  documentation  files (the  "Software"), to
 * deal in the Software without  restriction, including  without limitation the
 * rights to use, copy, modify, merge,  publish, distribute, sublicense, and/or
 * sell copies of the Software,  and to permit persons  to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice  and this permission notice  shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED  "AS IS", WITHOUT WARRANTY  OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING  BUT NOT  LIMITED TO THE  WARRANTIES OF  MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND  NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR  COPYRIGHT  HOLDERS BE  LIABLE FOR  ANY CLAIM,  DAMAGES  OR OTHER
 * LIABILITY,  WHETHER IN AN  ACTION OF  CONTRACT, TORT  OR OTHERWISE,  ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

"use strict";

var async = require('async');

var utils = require('../utils');

function mapJSON(targets, user) {
  return targets.map(function (tgt) { return tgt.toJSON(user); });
}

module.exports = function (manager) {
  var browse = require('express').Router();
  var readable = manager.folderAccessHandler('read');

  browse.get('/', function (req, res) {
    var listonly = req.query['list-only'];

    manager.userFolders(req.user, {
      recursive: !listonly,
      dirsOnly: true
    }, function (err, list) {
      if (err) {
        return res.status(err.statusCode||500).render('error');
      }

      res.render(listonly ? 'folder' : 'browse', {
        menuCtx: 'browse',
        folders: listonly ? [] : list,
        path: [],
        datapath: [],
        buildURL: (_p) => {
          _p = req.baseUrl.split('/').concat(_p==null ? [] : _p);
          return _p.map((a) => encodeURIComponent(a)).join('/');
        },
        pathid: '0',
        dirs: listonly ? list : list.map((f) => {
          var o = utils.merge({}, f);
          delete o.dirs;
          return o;
        }),
        files: []
      })
    });
  });

  browse.get(new RegExp('^/([^./][^/]*/?)(.*)$'), readable, function (req, res) {
    var folder = req.folder,
        listonly = req.query['list-only'],
        p = req.folderPath,
        resource = folder.resource(p.join('/'));

    async.parallel([
      (next) => listonly ? next(null, []) : manager.userFolders(req.user, {
        recursive: true,
        dirsOnly: true
      }, next),
      (next) => resource.scan(function (err, dirs, files) {
        if (err && err.fatal) {
          return next(err);
        }
        next(null, { dirs: dirs, files: files });
      }),
    ], function (err, results) {
      if (err) {
        return res.status(err.statusCode||500).render('error');
      }

      res.render(listonly ? 'folder' : 'browse', {
        menuCtx: 'browse',
        folders: results[0],
        folder: folder,
        path: p,
        datapath: [ folder.name ].concat(p),
        buildURL: (_p) => {
          _p = req.baseUrl.split('/').concat([ folder.name ]).concat(_p == null ? p : _p);
          return _p.map((a) => encodeURIComponent(a)).join('/');
        },
        pathid: resource.uid,
        dirs: results[1].dirs,
        files: results[1].files,
        err: err
      });
    });
  });

  browse.get('/.trash', function (req, res) {
    var listonly = req.query['list-only'];

    async.parallel([
      (next) => listonly ? next(null, []) : manager.userFolders(req.user, {
        recursive: true,
        dirsOnly: true
      }, next),
      (next) => manager.trash.list(req.user, next)
    ], function (err, results) {
      if (err) {
        return res.status(err.statusCode || 500).render('error');
      }

      return res.render(listonly ? 'folder' : 'browse', {
        menuCtx: 'browse',
        folders: listonly ? [] : results[0],
        folder: null,
        path: [],
        datapath: [ '.trash' ],
        buildURL: (tuid) => {
          var url = req.baseUrl.split('/');
          url.push('.trash');
          if (tuid) url.push(tuid);
          return url.map((a) => encodeURIComponent(a)).join('/');
        },
        pathid: 'trash',
        trash: results[1]
      });
    });
  });

  return browse;
}
