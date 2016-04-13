/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

var fs = require('fs-extra');
var basename = require('path').basename;
var dirname = require('path').dirname;

var conf = require('../../config');
var Folder = require('../../manager/folder');
var Uploads = require('../../manager/uploads');
var utils = require('../../utils');

var ACCESS_SPEC = {
  doc: "An access list (prefix usernames with '!' for readonly)",
  type: 'array',
  split: ',',
  validate: Folder.checkAccess
};

function _Check(can) {
  can = can.toLowerCase();

  if (can !== 'read' && can !== 'write') {
    throw new Error("Invalid folder access type. Must be 'read' or 'write'.");
  }

  return function (req, res, next) {
    var f = this.folder(req.params.folder);

    if (!f) return utils.notFound(res);

    if (!f.can(can, req.user)) {
      if (can !== 'read' && f.can('read', req.user)) {
        return utils.forbidden(res, 'folder.readonly', "Forbidden (read-only)");
      }
      return utils.notFound(res);
    }

    if (req.params.path) {
      if (!f.isSubPath(req.params.path)) {
        return utils.notFound(res);
      }
      req.resourcePath = f.getPath(req.params.path);
    } else {
      res.resourcePath = f.getPath();
    }
    req.folder = f;
    process.nextTick(next);
  }
}

/* use as preparePath.bind(type) */
function preparePath(req, res, next) {
  req.resourceType = this;
  process.nextTick(next);
}

/**
 * FileGet(req, res)
 */
function fileGet(req, res) {
  var p = req.resourcePath;
  if (req.query.attachment) {
    res.attachment(p);
  } else {
    res.type(basename(p));
  }

  res.sendFile(p, function (err) {
    if (err) {
      if (err.code === 'ECONNABORTED' || err.syscall === 'write') {
        return;
      }

      if (res.headersSent) {
        return res.end(); 
      }

      // Needed to generate json response
      res.removeHeader('Content-Disposition');
      res.removeHeader('Content-Type');

      if (err.code === 'ENOENT') {
        utils.notFound(res, 'file.notfound', "File not found");
      } else if (err.code === 'EISDIR') {
        utils.notFound(res, 'file.isdir', "Not a file");
      } else {
        console.log(err.toString());
        utils.unexpected(res);
      }
    }
  });
}

function fileSave(req, res) {
  var manager = this;

  /* Check body can be read and decoded. */
  try {
    Uploads.checkStream(req);
  } catch (e) {
    return utils.sendError(res, e);
  }

  fs.stat(req.resourcePath, function (err, stats) {
    var exist;

    if (err) {
      if (err.code === 'ENOTDIR') {
        return utils.conflict(res, 'file.path', "Parent is not a directory");
      } else if (err.code !== 'ENOENT') {
        console.log(err);
        return utils.unexpected(res);
      }

      // Check parent directory exists
      fs.stat(dirname(req.resourcePath), function (err, stats) {
        if (err) {
          if (err.code === 'ENOENT') {
            return utils.notfound(res, 'file.path', "Parent directory doesn't exist");
          }
          console.log(err);
          return utils.unexpected(res);
        }
        if (!stats.isDirectory()) {
          return utils.conflict(res, 'file.path', "Parent is not a directory");
        }
        save();
      });
    } else if (stats.isDirectory()) {
      utils.conflict(res, 'file.isdir', "Not a file");
    } else if (!req.query.replace) {
      utils.conflict(res, 'file.exist', "File already exists");
    } else {
      exist = true;
      save();
    }

    function save() {
      manager.uploads.save(req, function (err, tmp) {
        if (err) return utils.sendError(res, err);

        if (exist) {
          /* Move old file to trash first */
          manager.trash.trash(req.user, req.folder, req.resourcePath, function (err, uid) {
            if (err) return utils.sendError(res, err);
            rename(uid);
          });
        } else {
          rename();
        }

        function rename(uid) {
          fs.rename(tmp, req.resourcePath, function (err) {
            if (err) return utils.unexpected(res);

            var infos = req.folder.pathInfos('file', req.resourcePath, req.user);

            if (uid) {
              infos.replaced = {
                origin: req.folder.getRelativePath(true, req.resourcePath),
                trashUid: uid
              };
            }

            res.status(200).send(infos);
          });
        }
      });
    }
  });
}

function folderCreate(req, res) {
  var path = req.resourcePath;

  function done(err) {
    if (err) return utils.sendError(res, err);

    req.status(200).send(req.folder.pathInfos('folder', path, req.user));
  }

  fs.stat(path, function (err, stats) {
    if (err) {
      switch (err.code) {
        case 'ENOTDIR':
          return done(utils.error(409, "Parent is not a directory", {
            code: 'folder.parent.isfile'
          }));
        case 'ENOENT':
          break;
        default:
          console.log(err.toString());
          return done(utils.error(500, "Unexpected error", {
            code: 'unexpected',
            err: err.code
          }));
      }
    } else if (stats.isDirectory()) {
      return done(); // already exists => success
    } else {
      return done(utils.error(409, "Not a directory", {
        code: 'folder.isfile'
      }));
    }

    var fn = req.query.parents ? fs.ensureDir : fs.mkdir;

    fn(path, function (err) {
      var e;

      if (err) {
        switch (err.code) {
          case 'ENOENT':
            e = utils.error(404, "Parent directory doesn't exist", {
              code: 'folder.parent.notfound'
            });
            break;
          case 'ENOTDIR':
            e = utils.error(409, "Parent is not a directory", {
              code: 'folder.parent.isfile'
            });
            break;
          default:
            console.log(err.toString());
            e = utils.error(500, "Unexpected error", {
              code: 'unexpected',
              err: err.code
            });
        }
      }

      done(e);
    });
  });
}

function folderList(req, res) {
  function done(err, files, dirs) {
    if (err) return utils.sendError(res, err);
    res.status(200).send({
      folder: req.folder.name,
      dirname: req.folder.getRelativePath(req.resourcePath),
      path: req.folder.getRelativePath(true, req.resourcePath),
      files: files,
      dirs: dirs
    });
  }

  req.folder.list(req.resourcePath, function (err, files, dirs) {
    if (err) {
      if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
        return done(utils.error(404, "Directory not found", {
          code: 'folder.notfound'
        }));
      }
      console.log(err.toString());
      return utils.unexpected(res);
    }
    done(null, files, dirs);
  });
}

function repoCreate(req, res) {
  var f = this.folder(req.body.name, function (err, folder) {
    if (err) {
      console.log(err);
      return utils.unexpected(res);
    }

    res.status(200).send(folder.toObject(req.user));
  }, req.body);

  if (f) {
    res.conflict(409, "Folder already exists", 'folder.exists');
  }
}

function repoList(req, res) {
  var list = this.userFolders(req.user);
  res.status(200).send(list.map(function (f) {
    return f.toObject(req.user);
  }));
}

function resourceDelete(req, res) {
  var manager = this;

  manager.trash.trash(req.user, req.folder, req.resourcePath, function (err, uid) {
    if (err) {
      return res.status(err.statusCode || 500).send({
        error: err.message || "Unexpected error",
        details: err.details || { code: 'unexpected' }
      });
    }

    res.status(200).send({
      origin: req.folder.getRelativePath(true, req.resourcePath),
      trashUid: uid
    });
  }, req.resourceType);
}

/**
 * Check if a resource exists.
 *
 * Possible response http code:
 *   - 204: Resource exists and is of the right type
 *   - 404: Resource doesn't exist
 *   - 409: Resource exists but is not of the right type
 */
function resourceExist(req, res) {
  var type = req.resourceType;
  req.folder.stat(req.resourcePath, function (err, stats) {
    switch (err ? 'error' : type) {
      case 'error':
        res.status(404);
        break;
      case 'file':
        res.status(stats.isFile() ? 204 : 409);
        break;
      case 'folder':
      default:
        res.status(stats.isDirectory() ? 204 : 409);
        break;
    }
    res.end();
  });
}

function resourceRename(req, res) {
  var src = utils.partition(req.body.src||'', '/');
  var srcFolder = this.folder(src[0]);
  var dest = utils.partition(req.body.dest||'', '/');
  var destFolder = this.folder(dest[0]);

  if (!srcFolder || !srcFolder.canwrite(req.user)) {
    return utils.notFound(res, 'path.notfound', "resource not found");
  }

  if (!destFolder || !destFolder.canwrite(req.user)) {
    return utils.forbidden(res);
  }


}

function resourceStat(req, res) {
  var p = utils.partition(req.query.path, '/');
  var folder = this.folder(p[0]);

  if (!folder || !folder.canread(req.user)) {
    return utils.notFound(res, 'path.notfound', "Resource not found");
  }

  folder.stat(p[2], function (err, stats) {
    if (err) {
      var e;
      switch (err.code) {
        case 'EINVALID':
          e = utils.error(400, e.message, {
            code: 'path.invalid'
          });
          break;
        case 'ENOENT':
          e = utils.error(404, "Resource not found", {
            code: 'path.notfound'
          });
          break;
        case 'ENOTDIR':
          e = utils.error(409, "Parent is not a directory", {
            code: 'folder.parent.isfile'
          });
          break;
        default:
          console.log(err.toString());
          e = utils.error(500, "Unexpected error", {
            code: 'unexpected',
            err: err.code
          });
      }
      return utils.sendError(res, e);
    }

    var type = stats.isDirectory() ? 'folder' : 'file';
    var infos = folder.pathInfos(type, p[2], req.user);
    res.status(200).send(infos);
  });
}

function sharedList(req, res) {
  req.resourcePath = req.folder.getPath();
  folderList(req, res);
}

function sharedUpdate(req, res) {
  req.body.tasks = {}; // XXX reserved for future.
  req.folder.setInfos(req.body);
  req.folder.saveInfos(function (err) {
    if (err) {
      console.log(err.toString());
      return utils.unexpected(res);
    }
    res.status(200).send(req.folder.toObject(req.user));
  });
}

module.exports = function (manager) {
  // --- Handlers

  var checkRead =  _Check('read').bind(manager);
  var checkWrite = _Check('write').bind(manager);

  return [
    { path: "/repo/",
      authAs: "visitor",
      methods: {
        get: { doc: "List shared folders",
          query: {
            pattern: { doc: "Glob pattern to match folder names against",
              type: 'glob' },
            regexp: { doc: "Regular expression to match folder names against",
              type: 'regexp' }
          },
          handle: repoList.bind(manager)
        },
        post: { doc: "Create a shared folder",
          authAs: "admin",
          body: {
            name: { doc: "Folder name",
              required: true, validate: Folder.checkName },
            description: { doc: "Folder description" },
            access: ACCESS_SPEC,
          },
          handle: repoCreate.bind(manager)
        }
      }
    },
    { path: "/repo/rename",
      authAs: "contributor",
      methods: {
        post: { doc: "rename a resource",
          body: {
            src: { doc: "Path to a resource",
              required: true, validate: Folder.checkPath },
            dest: { doc: "New path of the resource",
              required: true, validate: Folder.checkPath },
            replace: { doc: "Replace target if src and dest are files",
              type: 'flag' },
            merge: { doc: "Merge directories if src and dest are directories",
              type: 'flag' }
          },
          handle: resourceRename.bind(manager)
        }
      }
    },
    { path: "/repo/stat",
      authAs: "visitor",
      methods: {
        get: { doc: "Get infos about a resource",
          query: {
            path: { doc: "Resource path",
              validate: Folder.checkPath }
          },
          handle: resourceStat.bind(manager)
        }
      }
    },
    { path: "/repo/:folder/",
      authAs: "visitor",
      params: {
        folder: { doc: "Folder name",
          validate: Folder.checkName }
      },
      methods: {
        get: { doc: "List contents of shared folder",
          query: {
            tree: { doc: "List subdirectories only (recursive)",
              type: 'flag' }
          },
          handle: [ checkRead, sharedList ]
        },
        head: { doc: "Check if a shared folder exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Update shared folder",
          authAs: "admin",
          body: {
            description: { doc: "Folder description" },
            access: ACCESS_SPEC,
          },
          handle: [ checkWrite, sharedUpdate.bind(manager) ]
        },
        'delete': { doc: "Delete shared folder",
          authAs: "admin",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    },
    { path: "/repo/:folder/:path+",
      authAs: "visitor",
      handle: preparePath.bind('file'),
      params: {
        folder: { doc: "Folder name",
          validate: Folder.checkName },
        path: { doc: "Path to a file",
          validate: Folder.checkPath }
      },
      methods: {
        get: { doc: "Get (download) a file",
          'content-type': '*',
          query: {
            attachment: { doc: "If set, the file will be sent as an attachment",
              type: 'flag' }
          },
          handle: [ checkRead, fileGet ]
        },
        head: { doc: "Check is a file exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Send a file",
          authAs: "contributor",
          query: {
            replace: { doc: "Replace file if it exists already. Default is to rename file.",
              type: 'flag' }
          },
          handle: [ checkWrite, fileSave.bind(manager) ]
        },
        'delete': { doc: "Delete a file",
          authAs: "contributor",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    },
    { path: "/repo/:folder/:path+/",
      authAs: "visitor",
      handle: preparePath.bind('folder'),
      params: {
        folder: { doc: "Folder name",
          validate: Folder.checkName },
        path: { doc: "Path to a sub-directory",
          validate: Folder.checkPath }
      },
      methods: {
        get: { doc: "List files and directory in path",
          query: {
            tree: { doc: "List subdirectories only (recursive)",
              type: 'flag' }
          },
          handle: [ checkRead, folderList ]
        },
        head: { doc: "Check if a directory exists",
          handle: [ checkRead, resourceExist ]
        },
        put: { doc: "Create a directory",
          authAs: "contributor",
          query: {
            parents: { doc: "Create missing parents",
              type: 'flag' }
          },
          handle: [ checkWrite, folderCreate ]
        },
        'delete': { doc: "Delete directory",
          authAs: "contributor",
          handle: [ checkWrite, resourceDelete.bind(manager) ]
        }
      }
    }
  ];
};
