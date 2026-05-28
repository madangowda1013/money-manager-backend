const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

async function ensureBudgetsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      period TEXT NOT NULL DEFAULT 'monthly',
      start_date DATE,
      end_date DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function normalizeBudgetBody(body) {
  return {
    category: body.category || body.name || body.title,
    amount: Number(body.amount || body.limit || body.budget_amount || body.budgetAmount),
    period: body.period || body.month || 'monthly',
    startDate: body.start_date || body.startDate || null,
    endDate: body.end_date || body.endDate || null
  };
}

router.get('/', auth, async (req, res) => {
  try {
    await ensureBudgetsTable();

    const result = await pool.query(
      `SELECT id, category, amount::float AS amount, period, start_date, end_date, created_at, updated_at
       FROM budgets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({ message: 'Unable to load budgets' });
  }
});

router.post('/', auth, async (req, res) => {
  const { category, amount, period, startDate, endDate } = normalizeBudgetBody(req.body);

  if (!category) {
    return res.status(400).json({ message: 'category is required' });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  try {
    await ensureBudgetsTable();

    const result = await pool.query(
      `INSERT INTO budgets (user_id, category, amount, period, start_date, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, category, amount::float AS amount, period, start_date, end_date, created_at, updated_at`,
      [req.user.id, category.trim(), amount, period, startDate, endDate]
    );

    res.status(201).json({ message: 'Budget saved', budget: result.rows[0] });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({ message: 'Unable to save budget' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { category, amount, period, startDate, endDate } = normalizeBudgetBody(req.body);

  if (!category) {
    return res.status(400).json({ message: 'category is required' });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  try {
    await ensureBudgetsTable();

    const result = await pool.query(
      `UPDATE budgets
       SET category = $1, amount = $2, period = $3, start_date = $4, end_date = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING id, category, amount::float AS amount, period, start_date, end_date, created_at, updated_at`,
      [category.trim(), amount, period, startDate, endDate, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    res.json({ message: 'Budget updated', budget: result.rows[0] });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({ message: 'Unable to update budget' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    await ensureBudgetsTable();

    const existing = await pool.query(
      'SELECT category, amount, period, start_date, end_date FROM budgets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    const merged = { ...existing.rows[0], ...req.body };
    const { category, amount, period, startDate, endDate } = normalizeBudgetBody(merged);

    const result = await pool.query(
      `UPDATE budgets
       SET category = $1, amount = $2, period = $3, start_date = $4, end_date = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING id, category, amount::float AS amount, period, start_date, end_date, created_at, updated_at`,
      [category.trim(), amount, period, startDate, endDate, req.params.id, req.user.id]
    );

    res.json({ message: 'Budget updated', budget: result.rows[0] });
  } catch (error) {
    console.error('Patch budget error:', error);
    res.status(500).json({ message: 'Unable to update budget' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureBudgetsTable();

    const result = await pool.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted' });
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({ message: 'Unable to delete budget' });
  }
});

module.exports = router;
