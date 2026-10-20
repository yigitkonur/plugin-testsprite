const express = require('express');

const app = express();
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));
app.post('/orders', (req, res) => res.status(201).json({ id: 1, ...req.body }));

app.listen(process.env.PORT || 3000);
