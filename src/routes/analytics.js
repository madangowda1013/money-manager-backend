const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: "Analytics route working" });
});

async function ensureTransactionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      category TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function summary(req, res) {
  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::float AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::float AS expenses
       FROM transactions
       WHERE user_id = $1`,
      [req.user.id]
    );

    const income = result.rows[0].income || 0;
    const expenses = result.rows[0].expenses || 0;

    res.json({
      income,
      expenses,
      totalIncome: income,
      totalExpenses: expenses,
      balance: income - expenses
    });
  } catch (error) {
    console.error('Analytics summary error:', error);
    res.status(500).json({ message: 'Unable to load analytics summary' });
  }
}

async function expensesByCategory(req, res) {
  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `SELECT category, SUM(amount)::float AS total, SUM(amount)::float AS amount
       FROM transactions
       WHERE user_id = $1 AND type = 'expense'
       GROUP BY category
       ORDER BY total DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Expenses by category error:', error);
    res.status(500).json({ message: 'Unable to load expenses by category' });
  }
}

async function monthlySummary(req, res) {
  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
         COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0)::float AS income,
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)::float AS expenses
       FROM transactions
       WHERE user_id = $1
       GROUP BY DATE_TRUNC('month', date)
       ORDER BY month`,
      [req.user.id]
    );

    res.json(result.rows.map((row) => ({
      ...row,
      balance: row.income - row.expenses
    })));
  } catch (error) {
    console.error('Monthly summary error:', error);
    res.status(500).json({ message: 'Unable to load monthly summary' });
  }
}

router.get('/summary', auth, summary);
router.get('/expenses-by-category', auth, expensesByCategory);
router.get('/expenses-by-category/', auth, expensesByCategory);
router.get('/monthly-summary', auth, monthlySummary);
router.get('/monthly', auth, monthlySummary);

router.summary = [auth, summary];
router.expensesByCategory = [auth, expensesByCategory];
router.monthlySummary = [auth, monthlySummary];

module.exports = router;
