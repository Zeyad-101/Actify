(() => {
  const installCard = document.getElementById('installCard');
  const installButton = document.getElementById('installButton');
  const iosInstallHint = document.getElementById('iosInstallHint');
  if (!installCard || !installButton || !iosInstallHint) return;

  console.log('Actify PWA display-mode matches:', ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].map(mode => ({
    [mode]: window.matchMedia(`(display-mode: ${mode})`).matches,
  })));
  const isStandalone = ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen']
    .some(mode => window.matchMedia(`(display-mode: ${mode})`).matches)
    || navigator.standalone === true;
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  function hideInstallCard() {
    installCard.hidden = true;
  }

  if (isStandalone) return;

  if (isIos) {
    installCard.hidden = false;
    installButton.hidden = true;
    iosInstallHint.hidden = false;
    return;
  }

  let deferredPrompt = null;
  installButton.hidden = false;
  iosInstallHint.hidden = true;

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    installCard.hidden = false;
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;

    const prompt = deferredPrompt;
    deferredPrompt = null;
    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch {
      // The browser can withdraw its native prompt; the card still closes for this session.
    } finally {
      hideInstallCard();
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallCard();
  });
})();
