const express = require('express');
const auth = require('../middleware/auth');
const pool = require('../config/db');

const router = express.Router();

async function ensureGoalsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS goals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      title TEXT NOT NULL,
      target_amount NUMERIC(12, 2) NOT NULL CHECK (target_amount > 0),
      current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
      deadline DATE,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS goal_progress (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      goal_id UUID,
      user_id UUID,
      amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
      date DATE NOT NULL DEFAULT CURRENT_DATE,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query('ALTER TABLE goal_progress ADD COLUMN IF NOT EXISTS user_id UUID');
  await pool.query('ALTER TABLE goal_progress ADD COLUMN IF NOT EXISTS date DATE DEFAULT CURRENT_DATE');
  await pool.query('ALTER TABLE goal_progress ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()');
  await pool.query('UPDATE goal_progress SET user_id = goals.user_id FROM goals WHERE goal_progress.goal_id = goals.id AND goal_progress.user_id IS NULL');
  await pool.query('UPDATE goal_progress SET date = CURRENT_DATE WHERE date IS NULL');
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

function normalizeDateInput(dateInput) {
  if (!dateInput) {
    return null;
  }

  if (typeof dateInput !== 'string') {
    return null;
  }

  const isoMatch = dateInput.match(/^\d{4}-\d{2}-\d{2}$/);
  if (isoMatch) {
    return dateInput;
  }

  const dmyMatch = dateInput.match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(dateInput);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

function mapGoalRow(goal) {
  return {
    id: goal.id,
    title: goal.name,
    name: goal.name,
    targetAmount: goal.target,
    target: goal.target,
    currentAmount: goal.current,
    current: goal.current,
    deadline: goal.targetDate,
    targetDate: goal.targetDate,
    status: goal.status,
    createdAt: goal.created_at || goal.createdAt,
    updatedAt: goal.updated_at || goal.updatedAt,
    progress: goal.progress || []
  };
}

function mapProgressRow(progress) {
  return {
    id: progress.id,
    goalId: progress.goal_id || progress.goalId,
    amount: progress.amount,
    date: progress.date,
    note: progress.note,
    createdAt: progress.created_at || progress.createdAt
  };
}

router.get('/', auth, async (req, res) => {
  try {
    await ensureGoalsTable();

    const result = await pool.query(
      `SELECT id, title AS name, target_amount::float AS target, current_amount::float AS current,
              deadline AS "targetDate", status, created_at, updated_at
       FROM goals
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const progressResult = await pool.query(
      `SELECT id, goal_id, amount::float AS amount, date, note, created_at
       FROM goal_progress
       WHERE user_id = $1
       ORDER BY date DESC, created_at DESC`,
      [req.user.id]
    );

    const progressByGoal = progressResult.rows.reduce((acc, progress) => {
      acc[progress.goal_id] = acc[progress.goal_id] || [];
      acc[progress.goal_id].push(progress);
      return acc;
    }, {});

    res.json(result.rows.map((goal) => mapGoalRow({
      ...goal,
      progress: progressByGoal[goal.id] || []
    })));
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({ message: 'Unable to load goals' });
  }
});

router.get('/:id', auth, async (req, res) => {
  try {
    await ensureGoalsTable();

    const result = await pool.query(
      `SELECT id, title AS name, target_amount::float AS target, current_amount::float AS current,
              deadline AS "targetDate", status, created_at, updated_at
       FROM goals
       WHERE id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const progressResult = await pool.query(
      `SELECT id, goal_id, amount::float AS amount, date, note, created_at
       FROM goal_progress
       WHERE goal_id = $1 AND user_id = $2
       ORDER BY date DESC, created_at DESC`,
      [req.params.id, req.user.id]
    );

    res.json(mapGoalRow({
      ...result.rows[0],
      progress: progressResult.rows.map(mapProgressRow)
    }));
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({ message: 'Unable to load goal' });
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
       RETURNING id, title AS name, target_amount::float AS target, current_amount::float AS current,
                 deadline AS "targetDate", status, created_at, updated_at`,
      [req.user.id, title.trim(), targetAmount, currentAmount, deadline, status]
    );

    res.status(201).json({ message: 'Goal saved', goal: mapGoalRow(result.rows[0]) });
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
       RETURNING id, title AS name, target_amount::float AS target, current_amount::float AS current,
                 deadline AS "targetDate", status, created_at, updated_at`,
      [title.trim(), targetAmount, currentAmount, deadline, status, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal updated', goal: mapGoalRow(result.rows[0]) });
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
       RETURNING id, title AS name, target_amount::float AS target, current_amount::float AS current,
                 deadline AS "targetDate", status, created_at, updated_at`,
      [title.trim(), targetAmount, currentAmount, deadline, status, req.params.id, req.user.id]
    );

    res.json({ message: 'Goal updated', goal: mapGoalRow(result.rows[0]) });
  } catch (error) {
    console.error('Patch goal error:', error);
    res.status(500).json({ message: 'Unable to update goal' });
  }
});

router.post('/:id/progress', auth, async (req, res) => {
  const amount = Number(req.body.amount);
  const rawDate = req.body.date || req.body.progress_date || req.body.targetDate || req.body.date_saved;
  const date = normalizeDateInput(rawDate) || new Date().toISOString().slice(0, 10);
  const note = req.body.note || null;

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ message: 'amount must be a positive number' });
  }

  if (!date) {
    return res.status(400).json({ message: 'date is invalid' });
  }

  try {
    await ensureGoalsTable();

    const goal = await pool.query(
      'SELECT id FROM goals WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (goal.rows.length === 0) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const result = await pool.query(
      `INSERT INTO goal_progress (goal_id, user_id, amount, date, note)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, goal_id, amount::float AS amount, date, note, created_at`,
      [req.params.id, req.user.id, amount, date, note]
    );

    await pool.query(
      'UPDATE goals SET current_amount = current_amount + $1, updated_at = NOW() WHERE id = $2 AND user_id = $3',
      [amount, req.params.id, req.user.id]
    );

    res.status(201).json({ message: 'Progress saved', progress: mapProgressRow(result.rows[0]) });
  } catch (error) {
    console.error('Create goal progress error:', error);
    res.status(500).json({ message: 'Unable to save goal progress' });
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
