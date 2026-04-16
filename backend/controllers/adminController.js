const Question = require('../models/Question');
const Log = require('../models/Log');
const User = require('../models/User');

const getQuestions = async (req, res) => {
  const questions = await Question.find({});
  res.json(questions);
};

const addQuestion = async (req, res) => {
  const { question, options, correctAnswer, category, timer } = req.body;
  const newQuestion = new Question({ question, options, correctAnswer, category, timer });
  const createdQuestion = await newQuestion.save();
  res.status(201).json(createdQuestion);
};

const editQuestion = async (req, res) => {
  const { question, options, correctAnswer, category, timer } = req.body;
  const q = await Question.findById(req.params.id);
  if (q) {
    q.question = question || q.question;
    q.options = options || q.options;
    q.correctAnswer = correctAnswer || q.correctAnswer;
    q.category = category || q.category;
    q.timer = timer || q.timer;
    const updatedQuestion = await q.save();
    res.json(updatedQuestion);
  } else {
    res.status(404).json({ message: 'Question not found' });
  }
};

const deleteQuestion = async (req, res) => {
  const question = await Question.findById(req.params.id);
  if (question) {
    await question.deleteOne();
    res.json({ message: 'Question removed' });
  } else {
    res.status(404).json({ message: 'Question not found' });
  }
};

const addBulkQuestions = async (req, res) => {
  // expects array of questions
  const questions = req.body.questions;
  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ message: 'Invalid data format' });
  }
  const created = await Question.insertMany(questions);
  res.status(201).json(created);
};

const getLogs = async (req, res) => {
  const logs = await Log.find({}).populate('userId', 'name email');
  res.json(logs);
};

const getUsers = async (req, res) => {
  const users = await User.find({ isAdmin: false }).select('_id name email score approved');
  console.log('Fetched users for admin:', users);
  res.json(users);
};

const approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.approved = true;
      await user.save();
      
      const io = req.app.get('io');
      if (io) {
        io.emit('approve_user', { userId: user._id });
      }

      res.json({ message: 'User approved', user });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (user) {
      user.approved = false;
      await user.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('reject_user', { userId: user._id });
      }
      
      res.json({ message: 'User rejected', user });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getQuestions, addQuestion, editQuestion, deleteQuestion, addBulkQuestions, getLogs, getUsers, approveUser, rejectUser };
