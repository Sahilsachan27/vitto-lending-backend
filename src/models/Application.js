const mongoose = require('mongoose');

const applicationSchema = new mongoose.Schema({
  applicationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  // Business Profile
  ownerName: { type: String, required: true, trim: true },
  pan: { type: String, required: true, uppercase: true, trim: true },
  businessType: {
    type: String,
    required: true,
    enum: ['retail', 'manufacturing', 'services', 'trading', 'food_beverage', 'agriculture', 'other'],
  },
  monthlyRevenue: { type: Number, required: true, min: 0 },

  // Loan Details
  loanAmount: { type: Number, required: true, min: 1 },
  tenureMonths: { type: Number, required: true, min: 1, max: 360 },
  loanPurpose: { type: String, required: true, trim: true },

  // Status
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },

  // Decision Reference
  decisionId: { type: String, default: null },

}, { timestamps: true });

module.exports = mongoose.model('Application', applicationSchema);
