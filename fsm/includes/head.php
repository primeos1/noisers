<?php
/* Shared <head> content — include this inside every page's <head> tag.
   Usage (admin pages):  <?php include '../includes/head.php'; ?>
   Usage (root pages):   <?php include 'includes/head.php'; ?> */
$_depth = (strpos($_SERVER['PHP_SELF'], '/admin/') !== false
        || strpos($_SERVER['PHP_SELF'], '/player/') !== false) ? '../' : '';
?>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="theme-color" content="#7c1d35">
<link rel="icon" href="<?php echo $_depth; ?>favicon.svg" type="image/svg+xml">
<link rel="icon" href="<?php echo $_depth; ?>football.png" type="image/png">
<link rel="apple-touch-icon" href="<?php echo $_depth; ?>football.png">
<link rel="manifest" href="<?php echo $_depth; ?>manifest.json">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jost:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      fontFamily: { jost: ['Jost','system-ui','sans-serif'] },
      colors: {
        burg:   { 950:'#3d0d18',900:'#5a1526',800:'#7c1d35',700:'#8a1f33',600:'#9e2542',500:'#c23055',400:'#d94f70',300:'#e97a96' },
        forest: { 950:'#051410',900:'#091f18',800:'#0e2a20',700:'#1b4332',600:'#2d6a4f',500:'#40916c',400:'#52b788',300:'#74c69d' },
        pitch:  { 950:'#0d0d10',900:'#141418',850:'#191920',800:'#1e1e24',700:'#26262e',600:'#34343c',500:'#4a4a54',400:'#6b6b78',300:'#8a8a96',200:'#c0c0cc',100:'#e0e0e8',50:'#f5f5f8' },
      },
    },
  },
}
</script>
<link rel="stylesheet" href="<?php echo $_depth; ?>assets/css/design-system.css">
<link rel="stylesheet" href="<?php echo $_depth; ?>assets/css/admin-compat.css">
<style>
#ios-install-banner {
  display: none;
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 9999;
  padding: 0 16px env(safe-area-inset-bottom, 16px);
  background: #191920;
  border-top: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 -8px 32px rgba(0,0,0,.5);
  font-family: 'Jost', sans-serif;
  transform: translateY(100%);
  transition: transform .35s cubic-bezier(.4,0,.2,1);
}
#ios-install-banner.visible {
  transform: translateY(0);
}
#ios-install-banner .iib-inner {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 18px 0 20px;
}
#ios-install-banner .iib-icon {
  flex-shrink: 0;
  width: 52px; height: 52px;
  border-radius: 14px;
  background: #7c1d35;
  display: flex; align-items: center; justify-content: center;
  font-size: 26px;
}
#ios-install-banner .iib-body { flex: 1; min-width: 0; }
#ios-install-banner .iib-title {
  font-size: 15px; font-weight: 700;
  color: #f5f5f8; margin: 0 0 4px;
}
#ios-install-banner .iib-sub {
  font-size: 13px; color: #8a8a96;
  margin: 0 0 12px; line-height: 1.4;
}
#ios-install-banner .iib-steps {
  display: flex; flex-direction: column; gap: 8px;
}
#ios-install-banner .iib-step {
  display: flex; align-items: center; gap: 10px;
  font-size: 13px; color: #c0c0cc;
}
#ios-install-banner .iib-step-num {
  flex-shrink: 0;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgba(124,29,53,.35);
  border: 1px solid rgba(124,29,53,.5);
  color: #d94f70; font-size: 11px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
#ios-install-banner .iib-share-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; vertical-align: middle;
  color: #4a9eff;
}
#ios-install-banner .iib-close {
  flex-shrink: 0;
  background: none; border: none; cursor: pointer;
  color: #4a4a54; padding: 4px; line-height: 1;
  align-self: flex-start;
}
#ios-install-banner .iib-arrow {
  width: 32px; text-align: center;
  position: fixed; bottom: calc(env(safe-area-inset-bottom, 16px) + 20px);
  left: 50%; transform: translateX(-50%);
  font-size: 22px;
  animation: iib-bounce .8s ease-in-out infinite alternate;
  pointer-events: none;
}
@keyframes iib-bounce {
  from { transform: translateX(-50%) translateY(0); }
  to   { transform: translateX(-50%) translateY(-6px); }
}
</style>

<div id="ios-install-banner" role="dialog" aria-label="Install app">
  <div class="iib-inner">
    <div class="iib-icon">⚽</div>
    <div class="iib-body">
      <p class="iib-title">Install Noisers Football Pro</p>
      <p class="iib-sub">Add to your home screen for the full app experience — no App Store needed.</p>
      <div class="iib-steps">
        <div class="iib-step">
          <span class="iib-step-num">1</span>
          <span>Tap the
            <svg class="iib-share-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <strong style="color:#4a9eff">Share</strong> button at the bottom of Safari
          </span>
        </div>
        <div class="iib-step">
          <span class="iib-step-num">2</span>
          <span>Scroll down and tap <strong style="color:#f5f5f8">Add to Home Screen</strong></span>
        </div>
        <div class="iib-step">
          <span class="iib-step-num">3</span>
          <span>Tap <strong style="color:#f5f5f8">Add</strong> — done!</span>
        </div>
      </div>
    </div>
    <button class="iib-close" id="ios-install-dismiss" aria-label="Dismiss">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</div>

<script>
(function () {
  var STORAGE_KEY = 'nfp_ios_install_dismissed';
  var SNOOZE_DAYS = 7;

  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isInStandaloneMode() {
    return ('standalone' in navigator && navigator.standalone) ||
      window.matchMedia('(display-mode: standalone)').matches;
  }
  function isSnoozed() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (!v) return false;
      return Date.now() < parseInt(v, 10);
    } catch (e) { return false; }
  }
  function snooze() {
    try {
      localStorage.setItem(STORAGE_KEY, Date.now() + SNOOZE_DAYS * 864e5);
    } catch (e) {}
  }

  if (!isIOS() || isInStandaloneMode() || isSnoozed()) return;

  window.addEventListener('load', function () {
    var banner = document.getElementById('ios-install-banner');
    var dismiss = document.getElementById('ios-install-dismiss');
    if (!banner) return;

    banner.style.display = 'block';
    setTimeout(function () { banner.classList.add('visible'); }, 600);

    dismiss.addEventListener('click', function () {
      banner.classList.remove('visible');
      snooze();
      setTimeout(function () { banner.style.display = 'none'; }, 400);
    });
  });
})();
</script>

<script>
document.addEventListener('DOMContentLoaded', function () {
  var sidebar = document.querySelector('.sidebar');
  if (!sidebar || document.querySelector('.admin-mobile-top-bar')) return;

  var logoEl   = sidebar.querySelector('.sidebar-logo');
  var teamEl   = sidebar.querySelector('.sidebar-team-name');
  var logoHTML = logoEl ? logoEl.outerHTML : '<a href="dashboard.php" class="sidebar-logo">NOISER FC <em>PRO</em></a>';
  var teamText = teamEl ? teamEl.textContent.trim() : '';

  var bar = document.createElement('div');
  bar.className = 'admin-mobile-top-bar';
  bar.innerHTML =
    '<div class="admin-mobile-bar-inner">' +
      '<div class="admin-mobile-bar-brand">' + logoHTML +
        (teamText ? '<span class="admin-mobile-bar-team">' + teamText + '</span>' : '') +
      '</div>' +
      '<button type="button" class="admin-mobile-bar-toggle" aria-label="Open menu" aria-expanded="false">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">' +
          '<line x1="3" y1="7" x2="21" y2="7"/>' +
          '<line x1="3" y1="12" x2="21" y2="12"/>' +
          '<line x1="3" y1="17" x2="21" y2="17"/>' +
        '</svg>' +
      '</button>' +
    '</div>';

  document.body.insertBefore(bar, document.body.firstChild);

  var toggle   = bar.querySelector('.admin-mobile-bar-toggle');
  var backdrop = document.createElement('div');
  backdrop.className = 'admin-sidebar-backdrop';

  function setSidebar(open) {
    document.body.classList.toggle('admin-sidebar-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', function () {
    setSidebar(!document.body.classList.contains('admin-sidebar-open'));
  });
  backdrop.addEventListener('click', function () { setSidebar(false); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setSidebar(false);
  });

  document.body.appendChild(backdrop);
});
</script>
