/**
 * VITTO CREDIT DECISION ENGINE
 * ─────────────────────────────────────────────────────────
 * Scoring model for MSME loan applications.
 *
 * CREDIT SCORE RANGE: 300 – 900 (higher = better)
 *
 * SCORING COMPONENTS (total 600 points possible):
 *
 * 1. Revenue-to-EMI Ratio (0–200 pts)
 *    EMI = loanAmount / tenureMonths (simplified flat rate)
 *    Ratio = monthlyRevenue / EMI
 *    ≥ 5x   → 200 pts (very safe, EMI is <20% of revenue)
 *    3–5x   → 150 pts (comfortable)
 *    2–3x   → 100 pts (tight but viable)
 *    1.5–2x → 50 pts  (risky)
 *    < 1.5x → 0 pts   (cannot service EMI)
 *
 * 2. Loan-to-Revenue Multiple (0–200 pts)
 *    Multiple = loanAmount / monthlyRevenue
 *    < 6x    → 200 pts (very small ask)
 *    6–12x   → 150 pts (reasonable)
 *    12–24x  → 100 pts (moderate)
 *    24–36x  → 50 pts  (aggressive)
 *    > 36x   → 0 pts   (excessive)
 *
 * 3. Tenure Risk Score (0–100 pts)
 *    6–36 months  → 100 pts (sweet spot)
 *    37–60 months → 80 pts  (acceptable)
 *    3–5 months   → 60 pts  (very short, risky cash flow)
 *    61–120 months→ 50 pts  (long-term risk)
 *    < 3 or > 120 → 0 pts   (outlier)
 *
 * 4. Business Type Factor (0–100 pts)
 *    services, trading         → 100 pts (stable cash flows)
 *    retail, food_beverage     → 80 pts
 *    manufacturing, agriculture→ 60 pts (capital intensive / seasonal)
 *    other                     → 70 pts
 *
 * BASE SCORE: 300 (minimum floor)
 * FINAL SCORE: 300 + (earned points / 600) * 600
 *
 * APPROVAL THRESHOLD: score ≥ 600
 *
 * HARD REJECT CONDITIONS (override score):
 *   - Revenue-to-EMI ratio < 1.0 (can't service loan at all)
 *   - Loan > 50x monthly revenue
 *   - Monthly revenue ≤ 0
 */

const APPROVAL_THRESHOLD = 600;

const BUSINESS_TYPE_SCORE = {
  services: 100,
  trading: 100,
  retail: 80,
  food_beverage: 80,
  other: 70,
  manufacturing: 60,
  agriculture: 60,
};

function calculateEMI(loanAmount, tenureMonths) {
  // Simplified flat-rate EMI (no interest rate — as a proxy for credit scoring)
  return loanAmount / tenureMonths;
}

function scoreRevenueToEMI(ratio) {
  if (ratio >= 5) return 200;
  if (ratio >= 3) return 150;
  if (ratio >= 2) return 100;
  if (ratio >= 1.5) return 50;
  return 0;
}

function scoreLoanToRevenue(multiple) {
  if (multiple < 6) return 200;
  if (multiple < 12) return 150;
  if (multiple < 24) return 100;
  if (multiple < 36) return 50;
  return 0;
}

function scoreTenure(tenureMonths) {
  if (tenureMonths >= 6 && tenureMonths <= 36) return 100;
  if (tenureMonths >= 37 && tenureMonths <= 60) return 80;
  if (tenureMonths >= 3 && tenureMonths <= 5) return 60;
  if (tenureMonths >= 61 && tenureMonths <= 120) return 50;
  return 0;
}

function buildReasonCodes({ revenueToEMI, loanToRevenue, tenureMonths, monthlyRevenue, loanAmount, decision }) {
  const codes = [];

  if (monthlyRevenue <= 0) codes.push('ZERO_OR_NEGATIVE_REVENUE');
  if (revenueToEMI < 1.5) codes.push('LOW_REVENUE_TO_EMI');
  if (revenueToEMI < 1.0) codes.push('CANNOT_SERVICE_EMI');
  if (loanToRevenue > 50) codes.push('EXCESSIVE_LOAN_AMOUNT');
  if (loanToRevenue > 36) codes.push('HIGH_LOAN_RATIO');
  if (loanToRevenue < 6) codes.push('CONSERVATIVE_LOAN_REQUEST');
  if (tenureMonths < 3) codes.push('TENURE_TOO_SHORT');
  if (tenureMonths > 120) codes.push('TENURE_TOO_LONG');
  if (loanAmount > monthlyRevenue * 50) codes.push('DATA_INCONSISTENCY');

  if (decision === 'APPROVED' && codes.length === 0) {
    codes.push('HEALTHY_FINANCIALS');
    if (revenueToEMI >= 5) codes.push('STRONG_REPAYMENT_CAPACITY');
    if (loanToRevenue < 6) codes.push('LOW_CREDIT_RISK');
  }

  return codes.length > 0 ? codes : (decision === 'APPROVED' ? ['ELIGIBLE'] : ['INSUFFICIENT_CREDITWORTHINESS']);
}

function runDecisionEngine({ monthlyRevenue, loanAmount, tenureMonths, businessType }) {
  const emi = calculateEMI(loanAmount, tenureMonths);
  const revenueToEMI = monthlyRevenue / emi;
  const loanToRevenue = loanAmount / monthlyRevenue;

  // Hard reject checks
  const hardReject =
    monthlyRevenue <= 0 ||
    revenueToEMI < 1.0 ||
    loanToRevenue > 50;

  let earnedPoints = 0;
  let creditScore = 300;

  if (!hardReject) {
    earnedPoints += scoreRevenueToEMI(revenueToEMI);
    earnedPoints += scoreLoanToRevenue(loanToRevenue);
    earnedPoints += scoreTenure(tenureMonths);
    earnedPoints += BUSINESS_TYPE_SCORE[businessType] || 70;
    creditScore = Math.round(300 + (earnedPoints / 600) * 600);
    creditScore = Math.min(900, Math.max(300, creditScore));
  } else {
    // Hard reject gets a low score
    creditScore = Math.min(
      450,
      300 + Math.round(Math.max(0, revenueToEMI - 0.5) * 50)
    );
  }

  const decision = (!hardReject && creditScore >= APPROVAL_THRESHOLD) ? 'APPROVED' : 'REJECTED';

  const reasonCodes = buildReasonCodes({
    revenueToEMI,
    loanToRevenue,
    tenureMonths,
    monthlyRevenue,
    loanAmount,
    decision,
  });

  return {
    decision,
    creditScore,
    reasonCodes,
    meta: {
      emiEstimate: parseFloat(emi.toFixed(2)),
      revenueToEMIRatio: parseFloat(revenueToEMI.toFixed(4)),
      loanToRevenueRatio: parseFloat(loanToRevenue.toFixed(4)),
      earnedPoints,
      hardReject,
    },
  };
}

module.exports = { runDecisionEngine };
