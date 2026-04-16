require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { Server } = require('socket.io');
const connectDB = require('./config/db');

// Routes
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const User = require('./models/User');
const Question = require('./models/Question');
const Log = require('./models/Log');
const QuizResult = require('./models/QuizResult');

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// ================= SOCKET =================
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
app.set('io', io);

let connectedUsers = {};
let cheatCounts = {};

let quizState = {
  isActive: false,
  isPaused: false,
  currentQuestionIndex: -1,
  questions: [],
  timer: 10,
  maxTimer: 10,
  intervalId: null,
  userResults: {}
};

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('register_user', (data) => {
    connectedUsers[socket.id] = { userId: data.userId, name: data.name, status: 'idle', isOnline: true };
    io.emit('admin_user_status', Object.values(connectedUsers));
  });

  socket.on('user_activity', (data) => {
    if (connectedUsers[socket.id]) {
      connectedUsers[socket.id].status = data.status;
      io.emit('admin_user_status', Object.values(connectedUsers));
    }
  });

  socket.on('admin_start_quiz', async () => {
    const questions = await Question.aggregate([{ $sample: { size: 10 } }]);
    quizState.questions = questions.map(q => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      correctAnswer: q.correctAnswer,
      timer: q.timer || 10
    }));
    quizState.isActive = true;
    quizState.isPaused = false;
    quizState.currentQuestionIndex = 0;
    quizState.userResults = {};

    io.emit('quiz_started');
    sendCurrentQuestion();
  });

  socket.on('admin_pause_quiz', () => {
    if (quizState.isActive) {
      quizState.isPaused = true;
      clearInterval(quizState.intervalId);
      io.emit('quiz_paused');
    }
  });

  socket.on('admin_resume_quiz', () => {
    if (quizState.isActive && quizState.isPaused) {
      quizState.isPaused = false;
      io.emit('quiz_resumed'); 
      quizState.intervalId = setInterval(() => {
        quizState.timer--;
        io.emit('timer_update', quizState.timer);
        if (quizState.timer <= 0) {
          clearInterval(quizState.intervalId);
          io.emit('question_result', { correctAnswer: quizState.questions[quizState.currentQuestionIndex].correctAnswer });
        }
      }, 1000);
    }
  });

  socket.on('admin_next_question', () => {
    quizState.currentQuestionIndex++;
    if (quizState.currentQuestionIndex >= quizState.questions.length) {
      endQuiz();
    } else {
      sendCurrentQuestion();
    }
  });

  socket.on('admin_end_quiz', () => {
    endQuiz();
  });

  socket.on('submit_answer', async (data) => {
    const { userId, questionId, selectedOption } = data;
    const currentQ = quizState.questions[quizState.currentQuestionIndex];
    if (!currentQ || currentQ._id.toString() !== questionId) return;

    if (!quizState.userResults[userId]) {
        quizState.userResults[userId] = { totalScore: 0, details: [] };
    }

    const timeTaken = quizState.maxTimer - quizState.timer;
    const isCorrect = currentQ.correctAnswer === selectedOption;

    quizState.userResults[userId].details.push({
        questionId: currentQ._id,
        questionText: currentQ.question,
        selectedOption,
        correctAnswer: currentQ.correctAnswer,
        isCorrect,
        timeTaken
    });

    if (isCorrect) {
      const user = await User.findById(userId);
      if (user && user.approved) {
        user.score += 10;
        quizState.userResults[userId].totalScore += 10;
        await user.save();
        io.emit('score_updated', { userId, score: user.score });
      }
    }
  });

  socket.on('cheat_detected', async (data) => {
    const { userId, event, name } = data; 
    await Log.create({ userId, event });
    
    if (!cheatCounts[userId]) cheatCounts[userId] = 0;
    cheatCounts[userId]++;

    io.emit('admin_cheat_alert', { userId, name, event, count: cheatCounts[userId], time: new Date() });

    if (cheatCounts[userId] >= 2) {
      const user = await User.findById(userId);
      if (user) {
        user.approved = false;
        await user.save();
        io.emit('user_disqualified', { userId });
      }
    }
  });

  socket.on('get_leaderboard', async () => {
    const users = await User.find({ isAdmin: false })
      .sort({ score: -1 })
      .limit(10)
      .select('name score');

    socket.emit('leaderboard_update', users);
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    if (connectedUsers[socket.id]) {
      connectedUsers[socket.id].isOnline = false;
      io.emit('admin_user_status', Object.values(connectedUsers));
      delete connectedUsers[socket.id];
    }
  });
});

// ================= FUNCTIONS =================
function sendCurrentQuestion() {
  clearInterval(quizState.intervalId);
  if (!quizState.isActive) return;

  const currentQ = quizState.questions[quizState.currentQuestionIndex];

  const clientQ = {
    _id: currentQ._id,
    question: currentQ.question,
    options: currentQ.options
  };

  quizState.maxTimer = currentQ.timer || 10;
  quizState.timer = quizState.maxTimer;

  io.emit('new_question', clientQ);
  io.emit('timer_update', quizState.timer);

  quizState.intervalId = setInterval(() => {
    quizState.timer--;
    io.emit('timer_update', quizState.timer);

    if (quizState.timer <= 0) {
      clearInterval(quizState.intervalId);
      io.emit('question_result', { correctAnswer: currentQ.correctAnswer });
    }
  }, 1000);
}

async function endQuiz() {
  quizState.isActive = false;
  quizState.isPaused = false;
  clearInterval(quizState.intervalId);
  io.emit('quiz_ended');
  
  // Save results globally
  for (const userId of Object.keys(quizState.userResults)) {
      try {
          await QuizResult.create({
              userId,
              totalScore: quizState.userResults[userId].totalScore,
              details: quizState.userResults[userId].details
          });
      } catch (err) { console.error('Error saving result', err); }
  }

  updateGlobalLeaderboard();
}

async function updateGlobalLeaderboard() {
  const users = await User.find({ isAdmin: false })
    .sort({ score: -1 })
    .limit(10)
    .select('name score');

  io.emit('leaderboard_update', users);
}

// ================= FRONTEND SERVE =================

app.use(express.static(path.join(__dirname, "../frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// ================= SERVER =================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});