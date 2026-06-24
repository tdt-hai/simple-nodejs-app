require('dotenv').config();
const express = require('express');
const os = require('os');
const app = express();

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';
const version = process.env.APP_VERSION || '1.0.0';

app.get('/', (req, res) => {
  res.json({
    message: 'Hello from Node.js app!',
    time: new Date().toISOString(),
    podName: os.hostname(),
    appVersion: version,
    platform: `${os.platform()} ${os.release()}`,
    nodeVersion: process.version
  });
});

app.listen(port, host, () => {
  console.log(`Example app listening at http://${host}:${port}`);
});
