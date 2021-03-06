/* partage
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * ISC Licensed
 */

"use strict";

function signIn(req, res) {
  /* TODO: Add support for a token to be passed in each request
   * (and bypass cookie-based sessions)
   */
  res.status(200).send(req.user.toJSON());
}

function signOut(req, res) {
  req.logout();
  res.send({});
}

module.exports = function (manager, app) {
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
          handle: [ app.passport.authenticate('local'), signIn ]
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
