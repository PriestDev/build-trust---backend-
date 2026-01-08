// routes/users.js
const express = require('express');
const router = express.Router();
const connection = require('../db'); // your MySQL connection

router.get('/users', (req, res) => {
  connection.query('SELECT * FROM users', (err, results) => {
    if (err) return res.status(500).send(err);
    res.json(results);
  });
});

module.exports = router;
