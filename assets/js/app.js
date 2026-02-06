(() => {
  // ====== Config ======
  const CFG = {
    secretTapCount: 3, // 左上を3回タップで隠しコマンド
    secretTapWindowMs: 1500, // 1.5秒以内に3回
    idleToSaverMs: 30_000,   // ゲーム画面: 30秒無操作でスクリーンセーバーへ
    resultToSaverMs: 300_000, // 結果画面: 5分(300秒)無操作でスクリーンセーバーへ
    weights: [
      { rank: '特賞', weight: 1, img: './assets/img/card_sp.png' },
      { rank: 'パンダ賞', weight: 10, img: './assets/img/card_01.png' },
      { rank: 'ウサギ賞', weight: 10, img: './assets/img/card_02.png' },
      { rank: 'コアラ賞', weight: 10, img: './assets/img/card_03.png' },
      { rank: 'イルカ賞', weight: 10, img: './assets/img/card_04.png' },
    ],
  };

  // ====== Elements ======
  const screens = {
    saver: document.getElementById('screenSaver'),
    game: document.getElementById('game'),
    result: document.getElementById('result'),
  };

  const hotspot = document.getElementById('secretHotspot');
  const btnBackToGame = document.getElementById('btnBackToGame');
  const btnExit = document.getElementById('btnExit');
  const cmVideo = document.getElementById('cmVideo');
  const bgVideo = document.getElementById('bgVideo');
  const gamePrompt = document.querySelector('.gamePrompt'); // Added

  // Cards
  const cardContainer = document.getElementById('cardContainer');
  const resultCardArea = document.getElementById('resultCardArea');
  const cards = Array.from(document.querySelectorAll('.cardBtn'));

  const elRank = document.getElementById('resultRank');
  const elSub = document.getElementById('resultSub');
  const elDate = document.getElementById('resultDate');

  // ====== State ======
  let idleTimer = null;
  let secretTaps = [];
  let isBusy = false;
  let currentCard = null;

  // ====== Sounds ======
  const sounds = {
    card: new Audio('./assets/se/card.mp3'),
    snare: new Audio('./assets/se/snare-roll.mp3'),
    fanfare: new Audio('./assets/se/fanfare.mp3'),
  };

  // プリロード
  Object.values(sounds).forEach(s => s.load());

  function playSound(key) {
    const s = sounds[key];
    if (!s) return;
    s.currentTime = 0;
    s.play().catch(() => { });
  }

  // --- Clone Play for Card (5 times overlap) ---
  function playCardSound() {
    const clone = sounds.card.cloneNode();
    clone.play().catch(() => { });
  }

  // ====== Helpers ======
  function show(screenKey) {
    Object.values(screens).forEach(el => el.classList.remove('is-active'));
    screens[screenKey].classList.add('is-active');
  }

  function resetIdleTimer() {
    clearTimeout(idleTimer);

    // 画面によってタイムアウト時間を変更
    let timeoutMs = CFG.idleToSaverMs; // デフォルト (Game画面)

    if (screens.result.classList.contains('is-active')) {
      timeoutMs = CFG.resultToSaverMs; // 結果画面は5分
    }

    idleTimer = setTimeout(() => {
      if (!screens.saver.classList.contains('is-active')) {
        goSaver();
      }
    }, timeoutMs);
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
    const total = CFG.weights.reduce((s, o) => s + o.weight, 0);
    let r = Math.random() * total;
    for (const o of CFG.weights) {
      r -= o.weight;
      if (r < 0) return o;
    }
    return CFG.weights[CFG.weights.length - 1];
  }

  async function safePlay(videoEl) {
    try {
      if (!videoEl) return;
      if (videoEl.paused) {
        const p = videoEl.play();
        if (p && typeof p.then === 'function') await p;
      }
    } catch (_) { }
  }

  // --- Card Logic ---
  function resetCards(isSilent = false) {
    cards.forEach(card => {
      // 親が違えば戻す
      if (card.parentElement !== cardContainer) {
        cardContainer.appendChild(card);
      }
      card.classList.remove('is-selected', 'is-faded', 'is-shaking', 'is-flipped', 'is-result-mode');
      card.style.transform = '';
      card.style.transition = '';

      const front = card.querySelector('.cardBtn__face--front');
      if (front) {
        front.textContent = '?';
        front.style.background = '';
      }
    });
    currentCard = null;
    // メッセージも戻す
    if (gamePrompt) gamePrompt.classList.remove('is-hidden');

    // 登場アニメーション発火
    // クラスを外して、リフローさせてから付ける
    cards.forEach(c => c.classList.remove('is-entering'));
    void cardContainer.offsetWidth; // Force reflow
    cards.forEach(c => c.classList.add('is-entering'));

    // SE: 5回再生 (100ms間隔)
    if (!isSilent) {
      for (let i = 0; i < 5; i++) {
        setTimeout(() => {
          playCardSound();
        }, (i + 1) * 100); // 100, 200, 300, 400, 500
      }
    }
  }

  function handleCardClick(clickedCard) {
    if (isBusy) return;
    isBusy = true;
    resetIdleTimer();
    currentCard = clickedCard;

    // SE: スネアロール
    playSound('snare');

    // メッセージを消す
    if (gamePrompt) gamePrompt.classList.add('is-hidden');

    // 1. 抽選 (オブジェクトが返る)
    const resultObj = pickRank();
    const resultRank = resultObj.rank;
    const resultImg = resultObj.img;

    // 2. 他のカードをフェードアウト
    cards.forEach(c => {
      if (c !== clickedCard) {
        c.classList.add('is-faded');
      }
    });

    // 3. 選ばれたカードを中央へ移動
    clickedCard.classList.add('is-selected');

    // 移動量計算
    const rect = clickedCard.getBoundingClientRect();
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const cardCX = rect.left + rect.width / 2;
    const cardCY = rect.top + rect.height / 2;
    const deltaX = centerX - cardCX;
    const deltaY = centerY - cardCY;

    // Game画面では scale(1.2)
    clickedCard.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(1.2)`;

    // 4. 演出（揺れ）
    setTimeout(() => {
      clickedCard.classList.add('is-shaking');
    }, 600);

    // 5. 結果表示（フリップ）
    setTimeout(() => {
      clickedCard.classList.remove('is-shaking');
      clickedCard.classList.add('is-flipped');

      const front = clickedCard.querySelector('.cardBtn__face--front');
      if (front) {
        front.textContent = ''; // テキストは消す
        // 画像セット
        front.style.background = `url(${resultImg}) center/cover no-repeat #fff`;
      }
    }, 2500);

    // 6. 結果画面へ遷移
    setTimeout(() => {
      showResult(resultRank, clickedCard);
    }, 4000); 
  }

  // --- Navigation ---

  function goSaver() {
    isBusy = false;
    show('saver');
    resetIdleTimer();
    safePlay(cmVideo);
    if (bgVideo) bgVideo.pause(); 
    resetCards(true);
  }

  function goGame() {
    if (isBusy) return;
    show('game');
    resetIdleTimer();
    try { cmVideo.pause(); } catch (_) { }
    if (bgVideo) safePlay(bgVideo); // 裏再生

    resetCards(false);
  }

  function showResult(rank, cardEl) {
    show('result');

    // SE: ファンファーレ
    playSound('fanfare');

    // カードをResult画面のプレースホルダーに移動（appendChildによる移動）
    // CSSで .is-result-mode をつけてスタイル調整
    if (cardEl && resultCardArea) {
      resultCardArea.appendChild(cardEl);
      cardEl.classList.add('is-result-mode');
      cardEl.style.transform = '';
      cardEl.style.transition = 'none';
    }

    elRank.textContent = rank;
    elSub.textContent = '景品をお選びください';
    elDate.textContent = nowStamp();
    resetIdleTimer();
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

  cards.forEach(card => {
    card.addEventListener('click', (e) => {
      e.stopPropagation();
      handleCardClick(card);
    });
  });

  btnBackToGame?.addEventListener('click', () => {
    resetIdleTimer();
    backToGame();
  });

  // 終了ボタン
  btnExit?.addEventListener('click', () => {
    // 即CMへ
    goSaver();
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
