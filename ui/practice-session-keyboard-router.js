(() => {
  'use strict';

  const INSTALLATION = Symbol.for('vocora.practiceSession.keyboardRouter');
  const RELEASE = '20260808-workflow1';

  function isEnter(event) {
    return event?.key === 'Enter' || event?.code === 'NumpadEnter';
  }

  function handle(event, windowObject = globalThis) {
    if (!isEnter(event)) return false;
    const controller = windowObject.VocoraPracticeRemediation;
    if (!controller || typeof controller.handleEnter !== 'function') return false;
    return controller.handleEnter(event);
  }

  function install(windowObject = globalThis) {
    if (!windowObject?.addEventListener) return false;
    if (windowObject[INSTALLATION]) return false;
    const handler = (event) => handle(event, windowObject);
    windowObject.addEventListener('keydown', handler, true);
    Object.defineProperty(windowObject, INSTALLATION, {
      value: handler,
      configurable: false,
      enumerable: false,
      writable: false
    });
    return true;
  }

  globalThis.VocoraPracticeKeyboardRouter = Object.freeze({ RELEASE, isEnter, handle, install });
  install();
})();
