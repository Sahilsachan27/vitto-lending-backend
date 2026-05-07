const { pool } = require('../config/postgres');

const auditLog = async ({ applicationId, eventType, payload, ipAddress }) => {
  try {
    await pool.query(
      `INSERT INTO audit_logs (application_id, event_type, payload, ip_address)
       VALUES ($1, $2, $3, $4)`,
      [applicationId, eventType, JSON.stringify(payload), ipAddress || 'unknown']
    );
  } catch (err) {
    // Non-fatal — just log to console so it doesn't break the request
    console.error('Audit log error:', err.message);
  }
};

const saveDecision = async ({ applicationId, decision, creditScore, reasonCodes, meta }) => {
  try {
    const result = await pool.query(
      `INSERT INTO decisions (
        application_id, credit_score, decision, reason_codes,
        monthly_revenue, loan_amount, tenure_months,
        emi_estimate, revenue_to_emi_ratio, loan_to_revenue_ratio
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING id`,
      [
        applicationId,
        creditScore,
        decision,
        reasonCodes,
        meta.monthlyRevenue,
        meta.loanAmount,
        meta.tenureMonths,
        meta.emiEstimate,
        meta.revenueToEMIRatio,
        meta.loanToRevenueRatio,
      ]
    );
    return result.rows[0].id;
  } catch (err) {
    console.error('Save decision error:', err.message);
    return null;
  }
};

const getDecisionHistory = async (limit = 50) => {
  const result = await pool.query(
    `SELECT * FROM decisions ORDER BY created_at DESC LIMIT $1`,
    [limit]
  );
  return result.rows;
};

module.exports = { auditLog, saveDecision, getDecisionHistory };
