(() => {
  // ====== Config ======
  const CFG = {
    secretTapCount: 3,
    secretTapWindowMs: 1500,   // 1.5秒以内に3回
    idleToSaverMs: 30_000,     // 30秒無操作でスクリーンセーバーへ
    storeName: '〇〇店',
    odds: [
      { rank: '特賞', weight: 3 },
      { rank: '1等', weight: 12 },
      { rank: '2等', weight: 35 },
      { rank: '3等', weight: 50 },
    ],
  };

  // ====== Elements ======
  const screens = {
    saver: document.getElementById('screenSaver'),
    game: document.getElementById('game'),
    lottery: document.getElementById('lottery'),
    result: document.getElementById('result'),
  };

  const hotspot = document.getElementById('secretHotspot');
  const btnChallenge = document.getElementById('btnChallenge');
  const btnBackToGame = document.getElementById('btnBackToGame');

  const cmVideo = document.getElementById('cmVideo');
  const lotteryVideo = document.getElementById('lotteryVideo');

  const elRank = document.getElementById('resultRank');
  const elSub = document.getElementById('resultSub');
  const elDate = document.getElementById('resultDate');
  const elStore = document.getElementById('resultStore');

  // ====== State ======
  let idleTimer = null;
  let secretTaps = [];
  let isBusy = false;

  // ====== Helpers ======
  function show(screenKey) {
    Object.values(screens).forEach(el => el.classList.remove('is-active'));
    screens[screenKey].classList.add('is-active');
  }

  function resetIdleTimer() {
  // 結果画面では自動復帰しない
  if (screens.result.classList.contains('is-active')) {
    clearTimeout(idleTimer);
    return;
  }

  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (!screens.saver.classList.contains('is-active')) {
      goSaver();
    }
  }, CFG.idleToSaverMs);
}


  function nowStamp() {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${yyyy}/${mm}/${dd} ${hh}:${mi}`;
  }

  function pickRank() {
    const total = CFG.odds.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    for (const o of CFG.odds) {
      r -= o.weight;
      if (r < 0) return o.rank;
    }
    return CFG.odds[CFG.odds.length - 1].rank;
  }

  async function safePlay(videoEl) {
    try {
      const p = videoEl.play();
      if (p && typeof p.then === 'function') await p;
    } catch (_) {}
  }

  function goSaver() {
    isBusy = false;
    show('saver');
    resetIdleTimer();
    safePlay(cmVideo);
  }

  function goGame() {
    if (isBusy) return;
    show('game');
    resetIdleTimer();
    try { cmVideo.pause(); } catch(_) {}
  }

  function goLotteryThenResult() {
    if (isBusy) return;
    isBusy = true;

    show('lottery');
    resetIdleTimer();

    try {
      lotteryVideo.pause();
      lotteryVideo.currentTime = 0;
    } catch(_) {}

    safePlay(lotteryVideo);
  }

  function showResult(rank) {
    show('result');
    resetIdleTimer();

    elRank.textContent = rank;
    elSub.textContent = '景品をお選びください';
    elDate.textContent = nowStamp();

    // ★自動で戻らない：ここで何もしない
    // isBusy は「結果表示中は二重抽選しない」ため true のまま維持
  }

  function backToGame() {
    isBusy = false;
    goGame();
  }

  // ====== Events ======
  hotspot.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const t = Date.now();
    secretTaps = secretTaps.filter(x => (t - x) <= CFG.secretTapWindowMs);
    secretTaps.push(t);

    if (secretTaps.length >= CFG.secretTapCount) {
      secretTaps = [];
      goGame();
    }
  });

  btnChallenge.addEventListener('click', () => {
    resetIdleTimer();
    goLotteryThenResult();
  });

  lotteryVideo.addEventListener('ended', () => {
    const rank = pickRank();
    showResult(rank);
  });

  btnBackToGame?.addEventListener('click', () => {
    resetIdleTimer();
    backToGame();
  });

  // どこを触っても無操作タイマーをリセット
  ['pointerdown', 'mousemove', 'keydown', 'touchstart'].forEach(evt => {
    window.addEventListener(evt, () => {
      resetIdleTimer();
    }, { passive: true });
  });

  window.addEventListener('load', () => {
    goSaver();
  });
})();
