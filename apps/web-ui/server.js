const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLM_URL = process.env.SLM_URL || 'http://vllm-server:8000'; // Changed to vllm-server

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/chat', async (req, res) => {
    try {
        const response = await axios({
            method: 'post',
            url: `${SLM_URL}/v1/chat/completions`, // OpenAI compatible endpoint
            data: {
                model: 'google/gemma-3-4b-it',
                messages: [{ role: 'user', content: req.body.prompt }],
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
                if (!line.trim() || line === 'data: [DONE]') {
                    if (line === 'data: [DONE]') {
                        res.write('data: [DONE]\n\n');
                        res.end();
                    }
                    return;
                }
                try {
                    const jsonStr = line.replace(/^data: /, '');
                    const json = JSON.parse(jsonStr);
                    const token = json.choices[0].delta.content;
                    if (token) {
                        res.write(`data: ${JSON.stringify({ token })}\n\n`);
                    }
                } catch (e) {
                    // Ignore parsing errors for empty/malformed lines
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
