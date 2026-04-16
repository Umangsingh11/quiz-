const mongoose = require('mongoose');

const quizResultSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    totalScore: {
      type: Number,
      required: true,
    },
    details: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Question' },
        questionText: String,
        selectedOption: String,
        correctAnswer: String,
        isCorrect: Boolean,
        timeTaken: Number,
      }
    ],
  },
  {
    timestamps: true,
  }
);

const QuizResult = mongoose.model('QuizResult', quizResultSchema);
module.exports = QuizResult;
