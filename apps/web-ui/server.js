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
        const response = await axios({
            method: 'post',
            url: `${SLM_URL}/api/generate`,
            data: {
                model: 'llama3',
                prompt: req.body.prompt,
                stream: true
            },
            responseType: 'stream'
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        response.data.on('data', chunk => {
            const lines = chunk.toString().split('\n');
            lines.forEach(line => {
                if (!line.trim()) return;
                try {
                    const json = JSON.parse(line);
                    if (json.response) {
                        res.write(`data: ${JSON.stringify({ token: json.response })}\n\n`);
                    }
                    if (json.done) {
                        res.write('data: [DONE]\n\n');
                        res.end();
                    }
                } catch (e) {
                    console.error('Error parsing Ollama stream chunk:', e.message);
                }
            });
        });

    } catch (error) {
        console.error('Error communicating with sLM:', error.message);
        res.status(500).json({ error: 'Failed to communicate with sLM server' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`Web UI listening on port ${PORT}`);
});
