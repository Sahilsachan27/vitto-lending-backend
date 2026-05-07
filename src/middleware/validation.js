const { body, validationResult } = require('express-validator');

// PAN format: 5 uppercase letters + 4 digits + 1 uppercase letter (e.g. ABCDE1234F)
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

const validateApplication = [
  body('ownerName')
    .trim()
    .notEmpty().withMessage('Owner name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Owner name must be 2–100 characters'),

  body('pan')
    .trim()
    .notEmpty().withMessage('PAN is required')
    .toUpperCase()
    .matches(PAN_REGEX).withMessage('Invalid PAN format. Expected format: ABCDE1234F'),

  body('businessType')
    .notEmpty().withMessage('Business type is required')
    .isIn(['retail', 'manufacturing', 'services', 'trading', 'food_beverage', 'agriculture', 'other'])
    .withMessage('Invalid business type'),

  body('monthlyRevenue')
    .notEmpty().withMessage('Monthly revenue is required')
    .isFloat({ min: 1 }).withMessage('Monthly revenue must be a positive number greater than 0')
    .toFloat(),

  body('loanAmount')
    .notEmpty().withMessage('Loan amount is required')
    .isFloat({ min: 1 }).withMessage('Loan amount must be a positive number greater than 0')
    .toFloat(),

  body('tenureMonths')
    .notEmpty().withMessage('Tenure is required')
    .isInt({ min: 1, max: 360 }).withMessage('Tenure must be between 1 and 360 months')
    .toInt(),

  body('loanPurpose')
    .trim()
    .notEmpty().withMessage('Loan purpose is required')
    .isLength({ min: 3, max: 500 }).withMessage('Loan purpose must be 3–500 characters'),
];

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: 'One or more fields are invalid',
      details: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

module.exports = { validateApplication, handleValidationErrors };
