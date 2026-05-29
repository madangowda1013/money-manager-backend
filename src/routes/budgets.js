const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

async function ensureBudgetsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS budgets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      category TEXT NOT NULL,
      monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
      month DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE budgets ADD COLUMN IF NOT EXISTS monthly_limit NUMERIC(12, 2)');
  await pool.query('ALTER TABLE budgets ADD COLUMN IF NOT EXISTS month DATE DEFAULT CURRENT_DATE');
  await pool.query('ALTER TABLE budgets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await pool.query('UPDATE budgets SET month = CURRENT_DATE WHERE month IS NULL');
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
      `SELECT id, category, monthly_limit::float AS amount, month, created_at, updated_at
       FROM budgets
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const budgetsByCategory = {};
    result.rows.forEach((budget) => {
      budgetsByCategory[budget.category] = budget.amount;
    });

    res.json(budgetsByCategory);
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
      `INSERT INTO budgets (user_id, category, monthly_limit, month)
       VALUES ($1, $2, $3, COALESCE($4::date, CURRENT_DATE))
       RETURNING id, category, monthly_limit::float AS amount, month, created_at, updated_at`,
      [req.user.id, category.trim(), amount, startDate || endDate || null]
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
       SET category = $1, monthly_limit = $2, month = COALESCE($3::date, month), updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, category, monthly_limit::float AS amount, month, created_at, updated_at`,
      [category.trim(), amount, startDate || endDate || null, req.params.id, req.user.id]
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
      'SELECT category, monthly_limit AS amount, month FROM budgets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    const merged = { ...existing.rows[0], ...req.body };
    const { category, amount, period, startDate, endDate } = normalizeBudgetBody(merged);

    const result = await pool.query(
      `UPDATE budgets
       SET category = $1, monthly_limit = $2, month = COALESCE($3::date, month), updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, category, monthly_limit::float AS amount, month, created_at, updated_at`,
      [category.trim(), amount, startDate || endDate || null, req.params.id, req.user.id]
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
      `DELETE FROM budgets
       WHERE user_id = $1 AND (id::text = $2 OR LOWER(category) = LOWER($2))
       RETURNING id`,
      [req.user.id, decodeURIComponent(req.params.id)]
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
