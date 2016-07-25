/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw Error("filehub is not defined.");

  var aJoin = Array.prototype.join,
      aSlice = Array.prototype.slice;

  function normPath(args, opts) {
    opts = opts || {};
    args = aSlice.call(args, opts.offset || 0);
    return (opts.prefix + args.join("/") + opts.suffix).replace(/\/+/g, "/");
  }

  var Api = filehub.createClass('Api', {
    options: {
      apiUrl: (window.FILEHUB_BASEURL || "") + "/api"
    },
    _init: function () {
      this.FILE_RE = new RegExp('^/[^/]+/.*[^/]$');
    },

    get: function (path, data) {
      return $.ajax(this.options.apiUrl + (path||''), {
        method: 'GET',
        accepts: { json: "application/json" },
        cache: false,
        data: data,
        dataType: 'json'
      });
    },
    head: function (path, data) {
      return $.ajax(this.options.apiUrl + (path||''), {
        method: 'HEAD',
        cache: false,
        data: data
      });
    },
    post: function (path, data) {
      if (data != null && typeof data !== 'string') {
        data = JSON.stringify(data);
      }

      return $.ajax(this.options.apiUrl + (path||''), {
        method: 'POST',
        accepts: { json: "application/json" },
        contentType: 'application/json',
        cache: false,
        data: data || "{}",
        dataType: 'json'
      });
    },
    put: function (path, data) {
      if (data != null && typeof data !== 'string') {
        data = JSON.stringify(data);
      }

      return $.ajax(this.options.apiUrl + (path||''), {
        method: 'PUT',
        accepts: { json: "application/json" },
        contentType: 'application/json',
        cache: false,
        data: data || "{}",
        dataType: 'json'
      });
    },
    del: function (path) {
      return $.ajax(this.options.apiUrl + (path||''), {
        method: 'DELETE',
        accepts: { json: "application/json" },
        cache: false,
        dataType: 'json'
      });
    },

    stat: function (path) {
      return this.get("/repo/stat", { path: path });
    },

    sendFileUrl: function (path, file, replace) {
      var fullpath = path.replace(/\/+$/, '') + "/" + file.name;

      return this.options.apiUrl + "/repo" + fullpath + (replace ? "?replace=1" : "");
    },

    getFile: function (path) {
      if (path[0] != "/") {
        path = "/" + path;
      }

      if (!this.FILE_RE.test(path)) return false;

      window.location.assign(this.options.apiUrl + "/repo" + path + '?attachment=1');

      return true;
    },
    list: function (path, tree) {
      return this.get("/repo" + (path || "/"), { tree : tree ? 1 : 0 });
    },
    exists: function (path) {
      return this.head("/repo" + (path || "/"));
    },
    trash: function (path) {
      return this.del("/repo" + path);
    },

    createFolder: function (folder, data) {
      data = data || {};
      data.name = folder;
      return this.post("/repo/", data);
    },
    updateFolder: function (folder, data) {
      return this.put("/repo/" + folder + "/", data || {});
    },

    createDir: function (path, recursive) {
      return this.put("/repo" + path + (recursive ? "?parents=1" : ""));
    },

    trashList: function () {
      return this.get("/trash");
    },
    trashEmpty: function () {
      return this.del("/trash");
    },
    trashGet: function (uid) {
      return this.get("/trash/"+uid);
    },
    trashDel: function (uid) {
      return this.del("/trash/"+uid);
    },

    account: function (username) {
      return this.get("/account/"+username);
    },
    accountExists: function (username) {
      return this.head("/account/"+username);
    },
    accountUpdate: function (username, data) {
      return this.put("/account/"+username, data || {});
    },
    accountDelete: function (username) {
      return this.del("/account/"+username);
    },

    accountsList: function (query) {
      var q = [];
      if (query.accessLevel) q.push("accessLevel="+query.accessLevel);
      if (query.email) q.push("email="+query.email);
      return this.get("/accounts" + (q.length ? ("?"+q.join("&")) : ""));
    },
    accountCreate: function (username, password, email, accessLevel) {
      var data = {
        username: username,
        password: password
      };
      if (email) data.email = email;
      if (accessLevel) data.accessLevel = accessLevel;

      return this.post("/accounts", data);
    }
  });
})(jQuery, window);