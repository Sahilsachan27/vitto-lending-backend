const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const Application = require('../models/Application');
const { runDecisionEngine } = require('../services/decisionEngine');
const { auditLog, saveDecision, getDecisionHistory } = require('../services/auditService');
const { validateApplication, handleValidationErrors } = require('../middleware/validation');
const { decisionLimiter } = require('../middleware/rateLimiter');

// ─────────────────────────────────────────
// POST /api/apply
// Submit full application (business + loan)
// ─────────────────────────────────────────
router.post('/apply', validateApplication, handleValidationErrors, decisionLimiter, async (req, res) => {
  const {
    ownerName, pan, businessType, monthlyRevenue,
    loanAmount, tenureMonths, loanPurpose,
  } = req.body;

  const applicationId = `VTO-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

  try {
    // 1. Save application to MongoDB
    const application = new Application({
      applicationId,
      ownerName,
      pan,
      businessType,
      monthlyRevenue,
      loanAmount,
      tenureMonths,
      loanPurpose,
      status: 'processing',
    });
    await application.save();

    // 2. Audit: application received
    await auditLog({
      applicationId,
      eventType: 'APPLICATION_SUBMITTED',
      payload: { ownerName, pan, businessType, monthlyRevenue, loanAmount, tenureMonths },
      ipAddress: req.ip,
    });

    // 3. Run decision engine
    const { decision, creditScore, reasonCodes, meta } = runDecisionEngine({
      monthlyRevenue,
      loanAmount,
      tenureMonths,
      businessType,
    });

    // 4. Save decision to PostgreSQL
    const decisionId = await saveDecision({
      applicationId,
      decision,
      creditScore,
      reasonCodes,
      meta: { monthlyRevenue, loanAmount, tenureMonths, ...meta },
    });

    // 5. Update MongoDB application with result
    await Application.findOneAndUpdate(
      { applicationId },
      { status: 'completed', decisionId },
    );

    // 6. Audit: decision made
    await auditLog({
      applicationId,
      eventType: 'DECISION_MADE',
      payload: { decision, creditScore, reasonCodes },
      ipAddress: req.ip,
    });

    return res.status(200).json({
      success: true,
      applicationId,
      decision,
      creditScore,
      reasonCodes,
      details: {
        emiEstimate: meta.emiEstimate,
        revenueToEMIRatio: meta.revenueToEMIRatio,
        loanToRevenueRatio: meta.loanToRevenueRatio,
      },
      submittedAt: new Date().toISOString(),
    });

  } catch (err) {
    await auditLog({
      applicationId,
      eventType: 'APPLICATION_FAILED',
      payload: { error: err.message },
      ipAddress: req.ip,
    });
    console.error('Apply error:', err);
    return res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong. Please try again.',
    });
  }
});

// ─────────────────────────────────────────
// GET /api/application/:id
// Get application status and decision
// ─────────────────────────────────────────
router.get('/application/:id', async (req, res) => {
  try {
    const app = await Application.findOne({ applicationId: req.params.id });
    if (!app) {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Application not found',
      });
    }
    return res.json({ success: true, application: app });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/history
// Get recent decision history (audit trail)
// ─────────────────────────────────────────
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const decisions = await getDecisionHistory(limit);
    return res.json({ success: true, count: decisions.length, decisions });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: err.message });
  }
});

// ─────────────────────────────────────────
// GET /api/health
// Health check
// ─────────────────────────────────────────
router.get('/health', (req, res) => {
  res.json({ success: true, status: 'OK', timestamp: new Date().toISOString() });
});

module.exports = router;
