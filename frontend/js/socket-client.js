const userStr = localStorage.getItem('user');
if (!userStr) {
  window.location.href = 'index.html';
}
const user = JSON.parse(userStr);

// Connect to socket
const BACKEND_URL = 'http://localhost:5000'; // Change in production
const socket = io(BACKEND_URL);

socket.on('connect', () => {
  console.log('Connected to socket server');
  socket.emit('register_user', { userId: user._id, name: user.name });
});

// If the server says the quiz has started, and we are not on the quiz page
socket.on('quiz_started', () => {
  if (!user.approved && !user.isAdmin) return;
  if (!window.location.pathname.includes('quiz.html')) {
    window.location.href = 'quiz.html';
  }
});

socket.on('approve_user', (data) => {
  if (data.userId === user._id) {
    user.approved = true;
    localStorage.setItem('user', JSON.stringify(user));
    if (typeof window.updateDashboardUIState === 'function') {
      window.updateDashboardUIState();
    }
  }
});

socket.on('reject_user', (data) => {
  if (data.userId === user._id) {
    alert('Your account has been rejected or deleted by the administrator.');
    localStorage.clear();
    window.location.href = 'index.html';
  }
});
