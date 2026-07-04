/* FiApp app-lock anti-flash guard. Split out of native-lock.js so THIS tiny script can stay
 * render-blocking (must run before first paint to hide a locked page) while the much larger
 * native-lock.js itself loads with `defer` (see base.html) - avoiding the render-blocking cost
 * of the full file on every page navigation. Checks window.Capacitor directly rather than
 * fiappIsNative() (native-auth.js), since that helper is now deferred and not yet defined when
 * this runs. A strict no-op in a plain browser and on native-shell pages where the lock is off.
 */
'use strict';
(function () {
  try {
    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()
        && localStorage.getItem('fiapp_app_lock') === '1'
        && sessionStorage.getItem('fiapp_lock_unlocked') !== '1') {
      document.documentElement.classList.add('fiapp-lock-pending');
    }
  } catch (e) { /* storage blocked: fall through, no lock */ }
})();
