const express = require('express');
const app = express();

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3001;
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running on 127.0.0.1:${PORT}`);
});