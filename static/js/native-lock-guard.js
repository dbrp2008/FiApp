'use strict';
(function () {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
        && localStorage.getItem('fiapp_app_lock') === '1'
        && sessionStorage.getItem('fiapp_lock_unlocked') !== '1') {
      document.documentElement.classList.add('fiapp-lock-pending');
    }
  } catch (e) {  }
})();
