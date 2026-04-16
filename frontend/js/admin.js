const userStr = localStorage.getItem('user');
if (!userStr) window.location.href = 'index.html';
const user = JSON.parse(userStr);
if (!user.isAdmin) window.location.href = 'dashboard.html';

const BACKEND_URL = 'http://localhost:5000';
const socket = io(BACKEND_URL);

const startBtn = document.getElementById('start-btn');
const pauseBtn = document.getElementById('pause-btn');
const nextBtn = document.getElementById('next-btn');
const endBtn = document.getElementById('end-btn');
const adminTimer = document.getElementById('admin-timer');

const addForm = document.getElementById('add-q-form');
const qList = document.getElementById('q-list');
const logsContainer = document.getElementById('logs-container');
const refreshLogsBtn = document.getElementById('refresh-logs-btn');

document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.clear();
  window.location.href = 'index.html';
});

// Socket Controls
startBtn.addEventListener('click', () => {
  if (confirm('Start the quiz for all connected users?')) {
    socket.emit('admin_start_quiz');
    startBtn.style.display = 'none';
    pauseBtn.style.display = 'inline-block';
    nextBtn.disabled = true;
    endBtn.disabled = false;
  }
});

let isPaused = false;
pauseBtn.addEventListener('click', () => {
  if (!isPaused) {
    socket.emit('admin_pause_quiz');
    pauseBtn.innerText = 'Resume Quiz';
    isPaused = true;
  } else {
    socket.emit('admin_resume_quiz');
    pauseBtn.innerText = 'Pause Quiz';
    isPaused = false;
  }
});

nextBtn.addEventListener('click', () => {
  socket.emit('admin_next_question');
  nextBtn.disabled = true;
});

endBtn.addEventListener('click', () => {
  if (confirm('Force end the quiz early?')) {
    socket.emit('admin_end_quiz');
    startBtn.disabled = false;
    nextBtn.disabled = true;
    endBtn.disabled = true;
  }
});

socket.on('timer_update', (time) => {
  adminTimer.innerText = time;
  if (time <= 0) {
    nextBtn.disabled = false; // Allow admin to proceed to next question manually
  }
});

socket.on('quiz_ended', () => {
  startBtn.style.display = 'inline-block';
  startBtn.disabled = false;
  pauseBtn.style.display = 'none';
  nextBtn.disabled = true;
  endBtn.disabled = true;
  alert('Quiz Ended. Live leaderboards will process details now.');
});

socket.on('admin_cheat_alert', (data) => {
  const div = document.createElement('div');
  div.style.marginBottom = '0.5rem';
  div.style.borderBottom = '1px solid #334155';
  div.style.paddingBottom = '0.5rem';
  div.style.color = data.count >= 2 ? 'var(--error)' : 'var(--warning)';
  const time = new Date(data.time).toLocaleTimeString();
  div.innerHTML = `[${time}] <b>${data.name || data.userId}</b>: ${data.event} (Offense: ${data.count})`;

  if (logsContainer.innerHTML.includes('No logs yet')) logsContainer.innerHTML = '';
  logsContainer.prepend(div);
});

const livePlayersContainer = document.getElementById('live-players-container');
socket.on('admin_user_status', (usersList) => {
  if (!livePlayersContainer) return;
  livePlayersContainer.innerHTML = '';
  if (usersList.length === 0) {
    livePlayersContainer.innerHTML = '<p style="color: var(--text-secondary);">Waiting for connections...</p>';
    return;
  }
  usersList.forEach(u => {
    const div = document.createElement('div');
    const statusColor = u.status === 'answering' ? 'var(--warning)' : 'var(--success)';
    div.style.marginBottom = '0.2rem';
    div.innerHTML = `🟢 <b>${u.name}</b> - <span style="color: ${statusColor}">${u.status.toUpperCase()}</span>`;
    livePlayersContainer.appendChild(div);
  });
});

// Load Questions
const loadQuestions = async () => {
  try {
    const questions = await request('/admin/questions', { method: 'GET' });
    qList.innerHTML = '';
    questions.forEach(q => {
      const div = document.createElement('div');
      div.style.background = 'var(--bg-color)';
      div.style.padding = '1rem';
      div.style.borderRadius = '8px';
      div.style.borderLeft = '4px solid var(--primary-color)';
      const qObjStr = encodeURIComponent(JSON.stringify(q));
      div.innerHTML = `
        <div style="display: flex; justify-content: space-between;">
          <b>${q.question}</b>
          <div>
            <button style="width: auto; padding: 0.2rem 0.5rem; background: var(--warning);" onclick="editQuestion('${q._id}', '${qObjStr}')">Edit</button>
            <button style="width: auto; padding: 0.2rem 0.5rem; background: var(--error);" onclick="deleteQuestion('${q._id}')">Delete</button>
          </div>
        </div>
        <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
          Options: ${q.options.join(' | ')}<br>
          <span style="color: var(--success); font-weight: bold;">Correct: ${q.correctAnswer}</span> | ⏱ ${q.timer || 10}s
        </div>
      `;
      qList.appendChild(div);
    });
  } catch (err) {
    alert(err.message);
  }
};

window.deleteQuestion = async (id) => {
  if (confirm('Delete this question?')) {
    try {
      await request(`/admin/questions/${id}`, { method: 'DELETE' });
      loadQuestions();
    } catch (err) {
      alert(err.message);
    }
  }
}

window.editQuestion = (id, qObjStr) => {
  const q = JSON.parse(decodeURIComponent(qObjStr));
  document.getElementById('q-text').value = q.question;
  document.getElementById('q-opt1').value = q.options[0] || '';
  document.getElementById('q-opt2').value = q.options[1] || '';
  document.getElementById('q-opt3').value = q.options[2] || '';
  document.getElementById('q-opt4').value = q.options[3] || '';
  document.getElementById('q-correct').value = q.correctAnswer;
  document.getElementById('q-timer').value = q.timer || 10;

  addForm.dataset.editingId = id;
  addForm.querySelector('button[type="submit"]').innerText = 'Update Question';
};

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const qText = document.getElementById('q-text').value;
  const opts = [
    document.getElementById('q-opt1').value,
    document.getElementById('q-opt2').value,
    document.getElementById('q-opt3').value,
    document.getElementById('q-opt4').value,
  ];
  const correct = document.getElementById('q-correct').value;
  const timer = parseInt(document.getElementById('q-timer').value) || 10;

  if (!opts.includes(correct)) {
    return alert('Correct answer must exactly match one of the options.');
  }

  try {
    const submitBtn = addForm.querySelector('button');
    submitBtn.innerText = 'Saving...';
    submitBtn.disabled = true;

    const payload = { question: qText, options: opts, correctAnswer: correct, timer: timer };

    if (addForm.dataset.editingId) {
      await request(`/admin/questions/${addForm.dataset.editingId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
      });
      delete addForm.dataset.editingId;
    } else {
      await request('/admin/questions', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
    }

    addForm.reset();
    document.getElementById('q-timer').value = 10; // reset default
    loadQuestions();
  } catch (err) {
    alert(err.message);
  } finally {
    const submitBtn = addForm.querySelector('button');
    submitBtn.innerText = 'Add Question';
    submitBtn.disabled = false;
  }
});

const loadLogs = async () => {
  try {
    const logs = await request('/admin/logs', { method: 'GET' });
    logsContainer.innerHTML = '';
    if (logs.length === 0) {
      logsContainer.innerHTML = '<p style="color: var(--text-secondary);">No logs yet...</p>'; return;
    }
    logs.reverse().forEach(log => {
      const div = document.createElement('div');
      div.style.marginBottom = '0.5rem';
      div.style.borderBottom = '1px solid #334155';
      div.style.paddingBottom = '0.5rem';
      const time = new Date(log.timestamp).toLocaleTimeString();
      div.innerHTML = `[${time}] <b>${log.userId ? log.userId.name : 'Unknown User'}</b>: ${log.event}`;
      logsContainer.appendChild(div);
    });
  } catch (err) {
    console.log(err);
  }
};

refreshLogsBtn.addEventListener('click', loadLogs);

// Init
loadQuestions();
loadLogs();

// User Management
const usersContainer = document.getElementById('users-container');
const refreshUsersBtn = document.getElementById('refresh-users-btn');

const fetchUsers = async () => {
  try {
    const response = await request('/admin/users', { method: 'GET' });
    console.log('Fetched users response:', response);
    const users = response;

    usersContainer.innerHTML = '';
    if (users.length === 0) {
      usersContainer.innerHTML = '<p style="color: var(--text-secondary);">No users registered...</p>'; return;
    }
    users.forEach(u => {
      const div = document.createElement('div');
      div.style.marginBottom = '0.5rem';
      div.style.borderBottom = '1px solid #334155';
      div.style.paddingBottom = '0.5rem';

      const statusColor = u.approved ? 'var(--success)' : 'var(--warning)';
      const statusText = u.approved ? 'Approved' : 'Waiting';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <b>${u.name}</b> (${u.email})<br/>
            <span style="font-size: 0.8rem; color: var(--text-secondary);">ID: ${u._id} | Score: <b>${u.score || 0}</b></span><br/>
            Status: <span style="font-size: 0.8rem; color: ${statusColor}; font-weight: bold;">${statusText}</span>
          </div>
          <div>
            ${!u.approved ? `<button style="background: var(--success); font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick="approveUser('${u._id}')">Approve</button>` : ''}
            <button style="background: var(--error); font-size: 0.8rem; padding: 0.3rem 0.6rem;" onclick="rejectUser('${u._id}')">Reject</button>
          </div>
        </div>
      `;
      usersContainer.appendChild(div);
    });
  } catch (err) {
    console.log(err);
  }
};

window.approveUser = async (id) => {
  try {
    await request(`/admin/users/${id}/approve`, { method: 'PUT' });
    fetchUsers();
  } catch (err) {
    alert(err.message);
  }
};

window.rejectUser = async (id) => {
  if (confirm('Are you sure you want to reject this user?')) {
    try {
      await request(`/admin/users/${id}/reject`, { method: 'PUT' });
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  }
};

socket.on('new_user_registered', (user) => {
  fetchUsers();
});

refreshUsersBtn.addEventListener('click', fetchUsers);
fetchUsers();
