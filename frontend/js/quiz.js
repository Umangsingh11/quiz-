/* =========================================================
   dashboard.js  —  Player Quiz Logic
   ========================================================= */

DB.init();

const Quiz = (() => {
  // ── State ──────────────────────────────────────────────
  let myId = null;
  let myName = '';
  let myScore = 0;
  let myCorrect = 0;
  let myWrong = 0;
  let mySkipped = 0;
  let answered = {};      // { questionId: answerIndex | 'skip' }
  let currentQ = null;    // current question object
  let lastQIdx = -1;      // last rendered question index
  let lastStatus = null;    // last quiz status
  let heartbeatTimer = null;
  let pollTimer = null;

  // ── Screen Manager ─────────────────────────────────────
  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
  }

  // ── Init ───────────────────────────────────────────────
  function init() {
    DB.on('*', poll);

    // Try to restore session
    const savedId = sessionStorage.getItem('quiz_my_id');
    const savedName = sessionStorage.getItem('quiz_my_name');
    if (savedId && savedName) {
      const users = DB.getUsers();
      if (users[savedId]) {
        myId = savedId;
        myName = savedName;
        restoreFromUser(users[savedId]);
        return;
      }
    }
    showScreen('screen-login');

    document.getElementById('player-name').addEventListener('keydown', e => {
      if (e.key === 'Enter') joinQuiz();
    });
  }

  function restoreFromUser(u) {
    myScore = u.score || 0;
    myCorrect = u.correct || 0;
    myWrong = u.wrong || 0;
    mySkipped = u.skipped || 0;
    answered = u.answers || {};
    poll();
  }

  // ── Join Quiz ──────────────────────────────────────────
  function joinQuiz() {
    const nameInput = document.getElementById('player-name');
    const name = nameInput.value.trim();
    const errEl = document.getElementById('join-error');

    if (!name) { showError('Please enter your name'); return; }
    if (name.length < 2) { showError('Name must be at least 2 characters'); return; }

    // Check for duplicate names
    const users = DB.getUsers();
    const duplicate = Object.values(users).find(u =>
      u.name.toLowerCase() === name.toLowerCase() && u.status !== 'rejected' && u.status !== 'kicked'
    );
    if (duplicate) { showError('This name is already taken. Choose another.'); return; }

    errEl.style.display = 'none';
    document.getElementById('join-btn').disabled = true;

    myId = DB.genId();
    myName = name;
    sessionStorage.setItem('quiz_my_id', myId);
    sessionStorage.setItem('quiz_my_name', myName);

    // Register user
    const freshUsers = DB.getUsers();
    freshUsers[myId] = {
      id: myId,
      name: myName,
      status: 'pending',
      online: true,
      lastSeen: Date.now(),
      quizStatus: 'idle',
      score: 0,
      correct: 0,
      wrong: 0,
      skipped: 0,
      answers: {},
      flagged: false,
      joinedAt: new Date().toISOString()
    };
    DB.setUsers(freshUsers);

    startHeartbeat();
    setupAntiCheat();
    poll();
  }

  function showError(msg) {
    const el = document.getElementById('join-error');
    el.textContent = msg;
    el.style.display = 'block';
    document.getElementById('join-btn').disabled = false;
  }

  // ── Poll for state changes ──────────────────────────────
  function poll() {
    if (!myId) return;

    const users = DB.getUsers();
    const me = users[myId];
    if (!me) { showScreen('screen-login'); return; }

    // Disqualified / kicked
    if (me.status === 'disqualified') {
      clearTimers();
      document.getElementById('dq-msg').textContent = 'You have been disqualified by the admin.';
      showScreen('screen-dq'); return;
    }
    if (me.status === 'kicked') {
      sessionStorage.clear();
      showScreen('screen-login'); return;
    }

    const state = DB.getState();

    // PENDING - waiting for approval
    if (me.status === 'pending') {
      showWaiting('⏳', 'Waiting for admin approval...', 'pending');
      return;
    }

    // APPROVED but quiz not started yet
    if (me.status === 'approved' && state.status === 'idle') {
      showWaiting('🎮', 'Quiz hasn\'t started yet. Get ready!', 'ready');
      return;
    }

    // QUIZ ACTIVE
    if (state.status === 'active' || state.status === 'paused') {
      const qs = DB.getQuestions();
      if (!qs.length) { showWaiting('📝', 'Loading questions...', 'ready'); return; }

      const qIdx = state.currentQuestion;
      const q = qs[qIdx];

      // Update quiz status in DB
      const freshUsers = DB.getUsers();
      if (freshUsers[myId]) {
        freshUsers[myId].quizStatus = 'playing';
        DB.setUsers(freshUsers);
      }

      showScreen('screen-quiz');
      updateHeader();

      // Render new question if changed
      if (qIdx !== lastQIdx || lastStatus !== state.status) {
        lastQIdx = qIdx;
        lastStatus = state.status;
        currentQ = q;
        renderQuestion(q, qIdx, qs.length, state);
      }

      // Always update timer
      updateTimer(state);
      return;
    }

    // QUIZ ENDED
    if (state.status === 'ended') {
      clearTimers();
      const freshUsers = DB.getUsers();
      if (freshUsers[myId]) {
        freshUsers[myId].quizStatus = 'finished';
        DB.setUsers(freshUsers);
      }
      showResult();
      return;
    }
  }

  // ── Waiting screen ─────────────────────────────────────
  function showWaiting(icon, msg, statusType) {
    showScreen('screen-wait');
    document.getElementById('wait-name').textContent = myName;
    const msgEl = document.getElementById('wait-message');
    const spinner = document.getElementById('wait-spinner');

    const colors = { pending: 'var(--amber)', ready: 'var(--cyan)', active: 'var(--green)' };
    const dotColors = { pending: '#ffb300', ready: '#00cfff', active: '#00e676' };

    msgEl.innerHTML = `
      <div class="wait-status">
        <span class="ws-dot" style="background:${dotColors[statusType] || '#5470a0'}"></span>
        <span style="color:${colors[statusType] || 'var(--muted)'}">${msg}</span>
      </div>`;
    spinner.style.display = statusType === 'pending' ? 'block' : 'none';
    if (statusType !== 'pending') {
      spinner.style.display = 'block';
      spinner.style.borderColor = colors[statusType];
      spinner.style.borderTopColor = 'transparent';
    }
  }

  // ── Render Question ────────────────────────────────────
  function renderQuestion(q, idx, total, state) {
    if (!q) return;

    document.getElementById('q-num').textContent = idx + 1;
    document.getElementById('q-total').textContent = total;
    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-cat').textContent = q.category || 'General';
    document.getElementById('q-pts').textContent = '+' + (q.points || 10) + ' pts';

    const diffEl = document.getElementById('q-diff');
    diffEl.textContent = q.difficulty || 'Medium';
    diffEl.className = 'qm-pill ' + (q.difficulty || 'Medium').toLowerCase();

    // Build options
    const grid = document.getElementById('options-grid');
    const letters = ['A', 'B', 'C', 'D'];
    const alreadyAnswered = answered[q.id];

    grid.innerHTML = q.options.map((opt, i) => {
      let cls = '';
      if (alreadyAnswered !== undefined && alreadyAnswered !== 'skip') {
        if (i === q.correct) cls = 'correct';
        else if (i === alreadyAnswered) cls = 'wrong';
      }
      return `<button class="opt-btn ${cls}" id="opt-${i}"
        onclick="Quiz.answer(${i})"
        ${alreadyAnswered !== undefined || state.status === 'paused' ? 'disabled' : ''}>
        <span class="opt-letter">${letters[i]}</span>
        ${opt}
      </button>`;
    }).join('');

    // Feedback
    const fb = document.getElementById('feedback');
    fb.className = 'feedback';
    fb.textContent = '';
    if (alreadyAnswered !== undefined) {
      if (alreadyAnswered === 'skip') {
        fb.className = 'feedback timeout'; fb.textContent = '⏱ Time\'s up! Moving to next question.';
      } else if (alreadyAnswered === q.correct) {
        fb.className = 'feedback correct'; fb.textContent = `✅ Correct! +${q.points || 10} points`;
      } else {
        fb.className = 'feedback wrong'; fb.textContent = `❌ Wrong! Correct answer: ${q.options[q.correct]}`;
      }
    }
  }

  // ── Timer ─────────────────────────────────────────────
  function updateTimer(state) {
    const t = state.timer || 0;
    const max = state.timerMax || 30;
    const pct = (t / max) * 100;

    const timerEl = document.getElementById('q-timer');
    const fillEl = document.getElementById('timer-bar-fill');
    if (!timerEl || !fillEl) return;

    timerEl.textContent = t;

    const color = pct > 50 ? 'var(--cyan)' : pct > 25 ? 'var(--amber)' : 'var(--red)';
    timerEl.style.color = color;
    fillEl.style.width = pct + '%';
    fillEl.style.background = color;

    // Auto-skip if time is 0 and not yet answered
    const q = currentQ;
    if (t === 0 && q && answered[q.id] === undefined) {
      autoSkip(q);
    }
  }

  function autoSkip(q) {
    if (!q || answered[q.id] !== undefined) return;
    answered[q.id] = 'skip';
    mySkipped++;
    saveProgress();
    document.getElementById('feedback').className = 'feedback timeout';
    document.getElementById('feedback').textContent = '⏱ Time\'s up!';
    document.querySelectorAll('.opt-btn').forEach(b => b.disabled = true);
    document.querySelectorAll('.opt-btn').forEach((b, i) => {
      if (i === q.correct) b.classList.add('reveal');
    });
  }

  // ── Answer ─────────────────────────────────────────────
  function answer(optIndex) {
    if (!currentQ) return;
    const q = currentQ;
    if (answered[q.id] !== undefined) return;

    answered[q.id] = optIndex;
    const isCorrect = optIndex === q.correct;

    if (isCorrect) {
      myScore += (q.points || 10);
      myCorrect++;
    } else {
      myWrong++;
    }

    // Visual feedback
    document.querySelectorAll('.opt-btn').forEach((btn, i) => {
      btn.disabled = true;
      if (i === optIndex && isCorrect) btn.classList.add('correct');
      else if (i === optIndex) btn.classList.add('wrong');
      else if (i === q.correct) btn.classList.add('reveal');
    });

    const fb = document.getElementById('feedback');
    if (isCorrect) {
      fb.className = 'feedback correct';
      fb.textContent = `✅ Correct! +${q.points || 10} points`;
    } else {
      fb.className = 'feedback wrong';
      fb.textContent = `❌ Wrong! Correct: ${q.options[q.correct]}`;
    }

    saveProgress();
    updateHeader();
  }

  function saveProgress() {
    const users = DB.getUsers();
    if (!users[myId]) return;
    users[myId].score = myScore;
    users[myId].correct = myCorrect;
    users[myId].wrong = myWrong;
    users[myId].skipped = mySkipped;
    users[myId].answers = answered;
    DB.setUsers(users);
  }

  function updateHeader() {
    document.getElementById('qh-name').textContent = myName;
    document.getElementById('qh-score-val').textContent = myScore;
    document.getElementById('qh-avatar').textContent = myName.substr(0, 1).toUpperCase();
  }

  // ── Result Screen ──────────────────────────────────────
  function showResult() {
    if (document.getElementById('screen-result').classList.contains('active')) return;

    const qs = DB.getQuestions();
    const total = qs.length;

    document.getElementById('res-name').textContent = myName;
    document.getElementById('res-score').textContent = myScore;
    document.getElementById('res-correct').textContent = myCorrect;
    document.getElementById('res-wrong').textContent = myWrong;
    document.getElementById('res-skip').textContent = mySkipped;

    // Trophy
    const pct = total ? myCorrect / total : 0;
    document.getElementById('res-trophy').textContent =
      pct >= .8 ? '🏆' : pct >= .5 ? '🥈' : pct >= .3 ? '🥉' : '😔';

    // Rank
    const users = DB.getUsers();
    const sorted = Object.values(users)
      .filter(u => u.status === 'approved')
      .sort((a, b) => (b.score || 0) - (a.score || 0));
    const rank = sorted.findIndex(u => u.id === myId) + 1;
    document.getElementById('res-rank').textContent = rank > 0 ? '#' + rank : '#-';

    // Mini leaderboard
    document.getElementById('res-lb').innerHTML = sorted.slice(0, 5).map((u, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const isMe = u.id === myId;
      return `<div class="lm-row" style="${isMe ? 'background:rgba(0,207,255,.06);border-radius:8px;padding:8px 4px;' : ''}">
        <div class="lm-rank">${medals[i] || (i + 1)}</div>
        <div class="lm-name" style="${isMe ? 'color:var(--cyan)' : ''}"> ${u.name}${isMe ? ' (You)' : ''}</div>
        <div class="lm-score">${u.score || 0}</div>
      </div>`;
    }).join('') || '<p style="color:var(--muted);font-size:13px;text-align:center">No data</p>';

    showScreen('screen-result');
  }

  // ── Heartbeat ──────────────────────────────────────────
  function startHeartbeat() {
    heartbeatTimer = setInterval(() => {
      DB.heartbeat(myId);
      poll();
    }, 5000);
    // Immediate first heartbeat
    DB.heartbeat(myId);
    poll();
  }

  function clearTimers() {
    if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  // ── Anti-Cheat ─────────────────────────────────────────
  function setupAntiCheat() {
    // Tab switch detection
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        const state = DB.getState();
        if (state.status === 'active') {
          flagUser('Tab switch detected');
        }
      }
    });

    // Right-click block during quiz
    document.addEventListener('contextmenu', (e) => {
      const state = DB.getState();
      if (state.status === 'active') { e.preventDefault(); flagUser('Right-click attempt'); }
    });

    // Dev tools (key shortcuts)
    document.addEventListener('keydown', (e) => {
      const state = DB.getState();
      if (state.status !== 'active') return;
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key))) {
        e.preventDefault(); flagUser('DevTools shortcut attempt');
      }
      // Block copy
      if (e.ctrlKey && e.key === 'c') { flagUser('Copy shortcut during quiz'); }
    });

    // Window blur (switching to another window)
    let blurTimer;
    window.addEventListener('blur', () => {
      blurTimer = setTimeout(() => {
        const state = DB.getState();
        if (state.status === 'active') flagUser('Window focus lost (possible tab switch)');
      }, 2000);
    });
    window.addEventListener('focus', () => clearTimeout(blurTimer));
  }

  function flagUser(event) {
    if (!myId) return;
    const users = DB.getUsers();
    if (!users[myId]) return;
    users[myId].flagged = true;
    DB.setUsers(users);
    DB.addCheatLog(myId, myName, event);
  }

  // ── Public API ─────────────────────────────────────────
  return { init, joinQuiz, answer };
})();

document.addEventListener('DOMContentLoaded', Quiz.init);