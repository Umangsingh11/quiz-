let cheatOffenses = 0;
const MAX_OFFENSES = 2;

// Prevent right click
document.addEventListener('contextmenu', event => event.preventDefault());

// Prevent copy/paste
document.addEventListener('copy', event => event.preventDefault());
document.addEventListener('paste', event => event.preventDefault());

const recordCheatEvent = (eventName) => {
  cheatOffenses++;
  console.warn(`Cheat detected: ${eventName}. Offense ${cheatOffenses}/${MAX_OFFENSES}`);
  
  socket.emit('cheat_detected', {
    userId: user._id,
    name: user.name,
    event: eventName
  });

  alert(`WARNING: Please do not switch tabs or exit fullscreen during the quiz! You may be disqualified.`);
  
  if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(err => console.log(err));
  }
};

socket.on('user_disqualified', (data) => {
  if (data.userId === user._id) {
    alert('You have violated the rules too many times. You are disqualified.');
    window.location.href = 'leaderboard.html';
  }
});

// Detect Tab Switch / Visibility Change
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    recordCheatEvent('Tab Switched / Minimized');
  }
});

// Detect Blur (Window focus lost)
window.addEventListener('blur', () => {
  recordCheatEvent('Window Focus Lost');
});

// Detect Fullscreen Exit
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    recordCheatEvent('Exited Fullscreen');
  }
});
