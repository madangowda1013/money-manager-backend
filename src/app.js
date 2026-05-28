// const express = require('express');

// app.use(express.json());


// const app = express();

// app.get('/', (req, res) => {
//     res.send('Backend is running');
// });

// const PORT = 3000;

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });
// this is the edited code 
// const express = require('express');
// const app = express();

// // Middleware to parse JSON
// app.use(express.json());

// // Test route
// app.get('/', (req, res) => {
//     res.send('Backend is running');
// });

// // Registration route
// // app.post('/api/auth/register', (req, res) => {
// //     const { full_name, email, password } = req.body;
// //     res.json({
// //         message: 'User registered successfully',
// //         user: { full_name, email }
// //     });
// // });

// const PORT = 3000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

//SECOND EDITED CODE 
// const express = require('express');
// const jwt = require('jsonwebtoken');

// const app = express();

// // Middleware to parse JSON
// app.use(express.json());

// // Secret key (use env variable in production)
// const SECRET_KEY = "your_secret_key";

// // Test route
// app.get('/', (req, res) => {
//     res.send('Backend is running');
// });

// // Registration route
// app.post('/api/auth/register', (req, res) => {
//     const { full_name, email, password } = req.body;

//     // Normally you'd save user to DB here and hash password

//     // Create token payload
//     const payload = { full_name, email };

//     // Sign token (expires in 1 hour)
//     const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

//     res.json({
//         message: 'User registered successfully',
//         token
//     });
// });

// const PORT = 3000;
// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

//===============prevese code =

// const express = require('express');
// const cors = require('cors');
// const jwt = require('jsonwebtoken');

// const app = express();

// app.use(cors());
// app.use(express.json());

// app.get('/health', (req, res) => {
//     res.json({ status: 'ok' });
// });

// // Secret key
// const SECRET_KEY = "your_secret_key";

// // Temporary storage
// let transactions = [];

// // ================= TEST ROUTE =================
// app.get('/', (req, res) => {
//     res.send('Backend is running');
// });

// //============liking and mounting======
// const authRoutes = require('./routes/auth');
// const transactionRoutes = require('./routes/transactions');
// const budgetRoutes = require('./routes/budgets');
// const goalRoutes = require('./routes/goals');
// const analyticsRoutes = require('./routes/analytics');

// app.use('/api/auth', authRoutes);
// app.use('/api/transactions', transactionRoutes);
// app.use('/api/budget', budgetRoutes);
// app.use('/api/goals', goalRoutes);
// app.use('/api/analytics', analyticsRoutes);


// // ================= SERVER =================
// const PORT = process.env.PORT || 3000;

// app.listen(PORT, () => {
//     console.log(`Server running on port ${PORT}`);
// });

require('dotenv').config({ quiet: true });

const express = require('express');
const cors = require('cors');

const app = express();

const allowedOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

app.use(cors({
    origin(origin, callback) {
        if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin.replace(/\/$/, ''))) {
            return callback(null, true);
        }

        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
}));
app.use(express.json());

// ================= HEALTH CHECK =================
app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
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
app.use('/api/goals', goalRoutes);
app.use('/api/analytics', analyticsRoutes);

// ================= SERVER =================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log('FRONTEND_URL =', allowedOrigins.join(', ') || '(all origins allowed)');
});
