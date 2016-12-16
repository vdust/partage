/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

var notImplemented = require('../../error').notImplemented;

var Resource = require('../../manager/resource');
var Trash = require('../../manager/trash');


function trashList(req, res, next) {
  this.scan(req.user, function (err, items) {
    if (err) next(err);
    res.status(200).send(items);
  });
}

function trashEmpty(req, res, next) {
  this.empty(req.user, function (err) {
    if (err) next(err);
    res.status(204).end();
  });
}

function trashGet(req, res, next) {
  this.stat(req.user, req.params.uid, function (err, infos) {
    if (err) return next(err);
    res.status(200).send(infos);
  });
}

function trashDelete(req, res, next) {
  this.remove(req.user, req.params.uid, function (err) {
    if (err) return next(err);
    res.status(204).end();
  });
}

function trashRestore(req, res, next) {
  var options = {};

  ['path', 'parents', 'replace', 'rename'].forEach(function (k) {
    if (req.body.hasOwnProperty(k)) options[k] = req.body[k];
  });

  this.restore(req.user, req.params.uid, options, function (err, resource, replaced) {
    if (err) return next(err);

    var infos = resource.toJSON(req.user);
    if (replaced) infos.replaced = replaced;

    res.status(200).send(infos);
  });
}

module.exports = function (manager) {
  return [
    { path: "/trash",
      authAs: "user",
      methods: {
        get: { doc: "List trashed resources",
          handle: trashList.bind(manager.trash)
        },
        'delete': { doc: "Empty trash",
          handle: trashEmpty.bind(manager.trash)
        }
      }
    },
    { path: "/trash/:uid",
      authAs: "user",
      params: {
        uid: { doc: "Trashed item id",
          validate: Trash.checkUid }
      },
      methods: {
        get: { doc: "Get trashed resource infos",
          handle: trashGet.bind(manager.trash)
        },
        'delete': { doc: "Delete trashed resource",
          handle: trashDelete.bind(manager.trash)
        }
      }
    },
    { path: "/trash/:uid/restore",
      authAs: "user",
      params: {
        uid: { doc: "Trashed item id",
          validate: Trash.checkUid }
      },
      methods: {
        post: { doc: "Restore trashed resource",
          body: {
            path: { doc: "Restore at this location instead of original location",
              validate: Resource.checkPath },
            parents: { doc: "Create missing parent directory (excluding root folder)",
              type: 'flag' },
            rename: { doc: "Rename the restored resource if target location exists.",
              type: 'flag' },
            replace: { doc: "Replace resource at target location if it exists.",
              type: 'flag' }
          },
          handle: trashRestore.bind(manager.trash)
        }
      }
    }
  ];
};
