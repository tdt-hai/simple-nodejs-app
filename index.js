require('dotenv').config();
const express = require('express');
const app = express();

const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';

app.get('/', (req, res) => {
  res.send('Hello World! This is a simple Node.js project. version 1');
});

app.listen(port, host, () => {
  console.log(`Example app listening at http://${host}:${port}`);
});
