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

const express = require('express');
const jwt = require('jsonwebtoken');

const app = express();

// Middleware to parse JSON
app.use(express.json());

// Secret key
const SECRET_KEY = "your_secret_key";

// Temporary storage
let transactions = [];

// ================= TEST ROUTE =================
app.get('/', (req, res) => {
    res.send('Backend is running');
});

// ================= REGISTER ROUTE =================
app.post('/api/auth/register', (req, res) => {

    const { full_name, email, password } = req.body;

    // Normally save user in DB here

    const payload = { full_name, email };

    const token = jwt.sign(payload, SECRET_KEY, {
        expiresIn: '1h'
    });

    res.json({
        message: 'User registered successfully',
        token
    });
});

// ================= ADD TRANSACTION =================
app.post('/api/transactions', (req, res) => {

    const transaction = req.body;

    transactions.push(transaction);

    res.status(201).json({
        message: 'Transaction added successfully',
        data: transaction
    });
});

// ================= GET TRANSACTIONS =================
app.get('/api/transactions', (req, res) => {

    res.json(transactions);

});

// ================= SERVER =================
const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});