/*!
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * MIT Licensed
 */

"use strict";

function signIn(req, res) {
  /* TODO: Add support for a token to be passed in each request
   * (and bypass cookie-based sessions)
   */
  res.status(200).send(req.user.publicInfos());
}

function signOut(req, res) {
  req.logout();
  res.send({});
}

module.exports = function (manager) {
  return [
    { path: "/login",
      methods: {
        post: { doc: "Sign in",
          body: {
            username: { doc: "User name",
              required: true },
            password: { doc: "Password",
              required: true }
          },
          handle: [ require('passport').authenticate('local'), signIn ]
        }
      }
    },
    { path: "/logout",
      methods: {
        post: { doc: "Sign out",
          handle: signOut
        }
      }
    }
  ];
};
