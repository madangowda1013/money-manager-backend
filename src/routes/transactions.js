const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

async function ensureTransactionsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS transactions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      category TEXT NOT NULL,
      description TEXT,
      transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

router.get('/', auth, async (req, res) => {
  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `SELECT id, type, amount, category, description, transaction_date, created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY transaction_date DESC, created_at DESC`,
      [req.user.id]
    );

    return res.json({ transactions: result.rows });
  } catch (error) {
    console.error('Get transactions error:', error);
    return res.status(500).json({ message: 'Unable to load transactions' });
  }
});

router.post('/', auth, async (req, res) => {
  const type = String(req.body.type || '').toLowerCase();
  const amount = Number(req.body.amount);
  const category = req.body.category;
  const description = req.body.description || null;
  const transactionDate = req.body.date || req.body.transaction_date || new Date().toISOString().slice(0, 10);

  if (!['income', 'expense'].includes(type)) {
    return res.status(400).json({ message: 'type must be income or expense' });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  if (!category) {
    return res.status(400).json({ message: 'category is required' });
  }

  try {
    await ensureTransactionsTable();

    const result = await pool.query(
      `INSERT INTO transactions (user_id, type, amount, category, description, transaction_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, type, amount, category, description, transaction_date, created_at`,
      [req.user.id, type, amount, category, description, transactionDate]
    );

    return res.status(201).json({
      message: 'Transaction saved',
      transaction: result.rows[0]
    });
  } catch (error) {
    console.error('Create transaction error:', error);
    return res.status(500).json({ message: 'Unable to save transaction' });
  }
});

module.exports = router;
