if (!user.approved && !user.isAdmin) {
  window.location.href = 'dashboard.html';
}

const quizContainer = document.getElementById('quiz-container');
const waitMsg = document.getElementById('wait-msg');
const timerDisplay = document.getElementById('timer-display');
const questionText = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');
const feedbackMsg = document.getElementById('feedback-msg');
const scoreDisplay = document.getElementById('user-score');

let currentQuestionId = null;
let answered = false;

// Socket listeners for quiz
socket.on('new_question', (q) => {
  currentQuestionId = q._id;
  answered = false;
  feedbackMsg.innerText = '';
  optionsContainer.innerHTML = '';
  
  
  questionText.innerText = q.question;
  
  socket.emit('user_activity', { status: 'answering' });

  q.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.innerText = opt;
    btn.onclick = () => selectOption(opt, btn);
    optionsContainer.appendChild(btn);
  });

  waitMsg.style.display = 'none';
  quizContainer.style.display = 'block';
});

let isPaused = false;
socket.on('quiz_paused', () => {
  isPaused = true;
  timerDisplay.innerText = "PAUSED";
  timerDisplay.style.color = "var(--error)";
});

socket.on('quiz_resumed', () => {
  isPaused = false;
  timerDisplay.style.color = "var(--warning)";
});

socket.on('timer_update', (time) => {
  if (isPaused) return;
  timerDisplay.innerText = time;
  if(time <= 3) {
    timerDisplay.style.color = 'var(--error)';
  } else {
    timerDisplay.style.color = 'var(--warning)';
  }
});

socket.on('question_result', (data) => {
  // Show correct answer
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(btn => {
    btn.disabled = true;
    if (btn.innerText === data.correctAnswer) {
      btn.classList.add('correct');
    } else if (btn.classList.contains('selected')) {
      btn.classList.add('wrong');
    }
  });

  if (!answered) {
    feedbackMsg.innerText = "Time's Up!";
    feedbackMsg.style.color = "var(--error)";
  }

  setTimeout(() => {
    quizContainer.style.display = 'none';
    waitMsg.style.display = 'block';
  }, 3000); // Wait 3s before showing wait screen
});

socket.on('score_updated', (data) => {
  if (data.userId === user._id) {
    scoreDisplay.innerText = `Score: ${data.score}`;
    user.score = data.score;
    localStorage.setItem('user', JSON.stringify(user));
  }
});

socket.on('quiz_ended', () => {
  window.location.href = 'leaderboard.html';
});

function selectOption(selectedOpt, btnElement) {
  if (answered) return;
  answered = true;
  
  btnElement.classList.add('selected');
  
  const btns = document.querySelectorAll('.option-btn');
  btns.forEach(btn => btn.disabled = true);

  socket.emit('submit_answer', {
    userId: user._id,
    questionId: currentQuestionId,
    selectedOption: selectedOpt
  });

  socket.emit('user_activity', { status: 'idle' });

  feedbackMsg.innerText = "Answer submitted. Waiting for result...";
  feedbackMsg.style.color = "var(--text-secondary)";
}

// Initial state
scoreDisplay.innerText = `Score: ${user.score || 0}`;
