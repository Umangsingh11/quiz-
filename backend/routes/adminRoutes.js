const express = require('express');
const router = express.Router();
const { getQuestions, addQuestion, deleteQuestion, addBulkQuestions, getLogs, getUsers, approveUser, rejectUser } = require('../controllers/adminController');
const { protect } = require('../middleware/auth');
const { admin } = require('../middleware/admin');

router.route('/questions')
  .get(protect, admin, getQuestions)
  .post(protect, admin, addQuestion);

router.route('/question')
  .post(protect, admin, addQuestion);

router.route('/questions/bulk')
  .post(protect, admin, addBulkQuestions);

router.route('/questions/:id')
  .put(protect, admin, editQuestion)
  .delete(protect, admin, deleteQuestion);

router.route('/question/:id')
  .put(protect, admin, editQuestion)
  .delete(protect, admin, deleteQuestion);

router.route('/logs')
  .get(protect, admin, getLogs);

router.route('/users')
  .get(protect, admin, getUsers);

router.route('/users/:id/approve')
  .put(protect, admin, approveUser);

router.route('/users/:id/reject')
  .put(protect, admin, rejectUser);

module.exports = router;
