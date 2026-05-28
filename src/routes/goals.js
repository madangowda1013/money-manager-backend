const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

async function ensureGoalsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
      current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
      deadline DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

function normalizeGoalBody(body) {
  return {
    title: body.title || body.name || body.goal,
    targetAmount: Number(body.target_amount || body.targetAmount || body.target || body.amount),
    currentAmount: Number(body.current_amount || body.currentAmount || body.saved_amount || body.savedAmount || body.saved || 0),
    deadline: body.deadline || body.target_date || body.targetDate || null,
    status: body.status || 'active'
  };
}

router.get('/', auth, async (req, res) => {
  try {
    await ensureGoalsTable();

    const result = await pool.query(
      `SELECT id, title, target_amount::float AS target_amount, current_amount::float AS current_amount,
              deadline, status, created_at, updated_at
       FROM goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Unable to load goals' });
  }
});

router.post('/', auth, async (req, res) => {
  const { title, targetAmount, currentAmount, deadline, status } = normalizeGoalBody(req.body);

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return res.status(400).json({ message: 'target amount must be a positive number' });
  }

  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return res.status(400).json({ message: 'current amount must be zero or greater' });
  }

  try {
    await ensureGoalsTable();

    const result = await pool.query(
      `INSERT INTO goals (user_id, title, target_amount, current_amount, deadline, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, target_amount::float AS target_amount, current_amount::float AS current_amount,
                 deadline, status, created_at, updated_at`,
      [req.user.id, title.trim(), targetAmount, currentAmount, deadline, status]
    );

    res.status(201).json({ message: 'Goal saved', goal: result.rows[0] });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({ message: 'Unable to save goal' });
  }
});

router.put('/:id', auth, async (req, res) => {
  const { title, targetAmount, currentAmount, deadline, status } = normalizeGoalBody(req.body);

  if (!title) {
    return res.status(400).json({ message: 'title is required' });
  }

  if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
    return res.status(400).json({ message: 'target amount must be a positive number' });
  }

  if (!Number.isFinite(currentAmount) || currentAmount < 0) {
    return res.status(400).json({ message: 'current amount must be zero or greater' });
  }

  try {
    await ensureGoalsTable();

    const result = await pool.query(
      `UPDATE goals
       SET title = $1, target_amount = $2, current_amount = $3, deadline = $4, status = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING id, title, target_amount::float AS target_amount, current_amount::float AS current_amount,
                 deadline, status, created_at, updated_at`,
      [title.trim(), targetAmount, currentAmount, deadline, status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal updated', goal: result.rows[0] });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({ message: 'Unable to update goal' });
  }
});

router.patch('/:id', auth, async (req, res) => {
  try {
    await ensureGoalsTable();

    const existing = await pool.query(
      'SELECT title, target_amount, current_amount, deadline, status FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const merged = { ...existing.rows[0], ...req.body };
    const { title, targetAmount, currentAmount, deadline, status } = normalizeGoalBody(merged);

    const result = await pool.query(
      `UPDATE goals
       SET title = $1, target_amount = $2, current_amount = $3, deadline = $4, status = $5, updated_at = NOW()
       WHERE id = $6 AND user_id = $7
       RETURNING id, title, target_amount::float AS target_amount, current_amount::float AS current_amount,
                 deadline, status, created_at, updated_at`,
      [title.trim(), targetAmount, currentAmount, deadline, status, req.params.id, req.user.id]
    );

    res.json({ message: 'Goal updated', goal: result.rows[0] });
  } catch (error) {
    console.error('Patch goal error:', error);
    res.status(500).json({ message: 'Unable to update goal' });
  }
});

router.delete('/:id', auth, async (req, res) => {
  try {
    await ensureGoalsTable();

    const result = await pool.query(
      'DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted' });
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({ message: 'Unable to delete goal' });
  }
});

module.exports = router;
