(function ($, window, undefined) {
  "use strict";

  var init = window['filehubInit'];

  if (!init) throw "filehub.js required";

  var View = init.View;

  init['users'] = function () {
    var handlers = {};
    handlers['navUpdate'] = function (item) {
      var txt = item.children('.tree-label').text();
      this.navPath.children().eq(-1).children('.navitem').text(txt);
    };
    return new View(handlers);
  };
})(jQuery, window);
