

require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

app.use(cors({
    origin: true,
    credentials: false
}));
app.use(express.json());

// ================= HEALTH CHECK =================
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

app.get('/health/db', async (req, res) => {
    try {
        const pool = require('./config/db');
        await pool.query('SELECT 1');
        res.json({ status: 'ok', database: 'connected' });
    } catch (error) {
        console.error('Database health check error:', error);
        res.status(500).json({ status: 'error', database: 'unreachable' });
    }
});

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// ================= ROUTES =================
const authRoutes = require('./routes/auth');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const goalRoutes = require('./routes/goals');
const analyticsRoutes = require('./routes/analytics');

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budget', budgetRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/goal', goalRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);
app.get('/api/summary', analyticsRoutes.summary);
app.get('/api/expenses-by-category', analyticsRoutes.expensesByCategory);
app.get('/api/monthly-summary', analyticsRoutes.monthlySummary);

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('FRONTEND_URL =', allowedOrigins.join(', ') || '(all origins allowed)');
});
