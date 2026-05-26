// const express = require('express');
// const jwt = require('jsonwebtoken');
// const router = express.Router();

// const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// router.post('/register', (req, res) => {
//   const { full_name, email, password } = req.body;

//   if (!full_name || !email || !password) {
//     return res.status(400).json({ message: 'full_name, email, and password are required' });
//   }

//   const payload = { full_name, email };
//   const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

//   res.status(201).json({
//     message: 'User registered successfully',
//     token
//   });
// });

// router.post('/login', (req, res) => {
//     const { email, password } = req.body;
  
//     if (!email || !password) {
//       return res.status(400).json({
//         message: "email and password are required"
//       });
//     }
  
//     res.json({
//       message: "Login successful",
//       token: "demo-token-123"
//     });
//   });

// module.exports = router;



const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_key';

// REGISTER
router.post('/register', (req, res) => {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({
      message: 'full_name, email, and password are required'
    });
  }

  const payload = { full_name, email };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

  return res.status(201).json({
    message: 'User registered successfully',
    token
  });
});

// LOGIN
router.post('/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "email and password are required"
    });
  }

  // NOTE: (temporary login logic — no DB yet)
  const payload = { email };

  const token = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

  return res.json({
    message: "Login successful",
    token
  });
});
router.get('/test', (req, res) => {
    res.json({ message: "auth working" });
  });
module.exports = router;