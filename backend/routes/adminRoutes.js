const express = require('express');
const router = express.Router();

const {
  getQuestions,
  addQuestion,
  editQuestion,   // ✅ FIX ADDED
  deleteQuestion,
  addBulkQuestions,
  getLogs,
  getUsers,
  approveUser,
  rejectUser
} = require('../controllers/adminController');

const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

// Get all questions / Add question
router.route('/questions')
  .get(protect, admin, getQuestions)
  .post(protect, admin, addQuestion);

// Add single question
router.route('/question')
  .post(protect, admin, addQuestion);

// Bulk add questions
router.route('/questions/bulk')
  .post(protect, admin, addBulkQuestions);

// Update / Delete question
router.route('/questions/:id')
  .put(protect, admin, editQuestion)
  .delete(protect, admin, deleteQuestion);

// Alternative route
router.route('/question/:id')
  .put(protect, admin, editQuestion)
  .delete(protect, admin, deleteQuestion);

// Logs
router.route('/logs')
  .get(protect, admin, getLogs);

// Users
router.route('/users')
  .get(protect, admin, getUsers);

// Approve user
router.route('/users/:id/approve')
  .put(protect, admin, approveUser);

// Reject user
router.route('/users/:id/reject')
  .put(protect, admin, rejectUser);

module.exports = router;