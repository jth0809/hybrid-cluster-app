const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLM_URL = process.env.SLM_URL || 'http://slm-server:11434';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
    try {
        const response = await axios.post(`${SLM_URL}/api/generate`, {
            model: 'llama3', // Default model
            prompt: req.body.prompt,
            stream: false
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error communicating with sLM:', error.message);
        res.status(500).json({ error: 'Failed to communicate with sLM server' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`Web UI listening on port ${PORT}`);
});
