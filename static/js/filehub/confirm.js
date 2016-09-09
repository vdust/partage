/**
 * filehub
 * Copyright (c) 2016 Raphaël Bois Rousseau
 * License: MIT
 */

(function ($, window, undefined) {
  'use strict';

  var filehub = window['filehub'];
  if (!PROD && !filehub) throw new Error("filehub is not defined.");

  var NS = 'fh-confirm';

  $.fn.confirmDialog = function (options) {
    if (typeof options === 'string') {
      var res = this,
          args = arguments,
          context, confirmcb, data;

      if (res.length > 1) {
        console.warn("Can't proceed with multiple dialog instances at once.");
        return;
      }

      switch (options) {
        case 'confirm':
          context = args[1];
          confirmcb = args[2];

          if (!res.length) {
            setTimeout(confirmcb, 0);
            break;
          }

          data = res.data(NS);

          if (!data) {
            console.warn("confirmDialog is not initialized");
            return;
          }

          // Ensure previous callbacks are cleared
          res.off('.'+NS);

          if (typeof confirmcb === 'function') {
            res.one('confirm.'+NS, function (e) { confirmcb(function () {
              res.modal('hide');
            }); });
          }

          data.contextual.each(function () {
            $(this).toggle($(this).data('context') === context);
          });

          data.progress.hide();
          data.msg.show();
          data.buttons.show();
          res.modal('handleUpdate');

          res.modal('show');
          break;
        case 'close':
          res.modal('hide');
          break;
        default:
          console.warn("Unknown confirmDialog method: " + options);
          return;
      }

      return res;
    }

    return this.each(function () {
      var dialog = $(this);

      var data = {
        contextual: dialog.find('[data-context]'),
        progress: dialog.find('.confirm-progress'),
        msg: dialog.find('.confirm-msg'),
        buttons: dialog.find('.modal-footer,.modal-header')
      };

      dialog.on('confirm', function (e) {
        data.progress.show();
        data.msg.hide();
        data.buttons.hide();
        dialog.modal('handleUpdate');
      }).data(NS, data).modal({
        keyboard: false,
        show: false
      }).on('click', 'button', function (e) {
        var action = $(this).data('action');

        if (!action) return;

        if (action === 'confirm') {
          e.preventDefault();
          dialog.trigger('confirm');
        }
      });
    });
  };
}(jQuery, window));
