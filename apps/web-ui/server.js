const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SLM_URL = process.env.SLM_URL || 'http://vllm-server:8000';
const EMBEDDING_URL = process.env.EMBEDDING_URL || 'http://embedding-service:8000';
const QDRANT_URL = process.env.QDRANT_URL || 'http://qdrant:6333';
const COLLECTION_NAME = 'knowledge_base';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function getContext(query) {
    try {
        console.log(`Getting context for: ${query}`);
        // 1. Get embedding
        const embRes = await axios.post(`${EMBEDDING_URL}/v1/embeddings`, {
            input: query,
            model: 'paraphrase-multilingual-MiniLM-L12-v2'
        });
        const vector = embRes.data.data[0].embedding;

        // 2. Search Qdrant
        const searchRes = await axios.post(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
            vector: vector,
            limit: 3,
            with_payload: true
        });

        const context = searchRes.data.result
            .map(r => r.payload.text)
            .join('\n\n');

        console.log(`Retrieved context length: ${context.length}`);
        return context;
    } catch (e) {
        console.warn('RAG retrieval failed, falling back to basic chat:', e.message);
        return '';
    }
}

app.post('/api/chat', async (req, res) => {
    try {
        const userPrompt = req.body.prompt;
        const context = await getContext(userPrompt);

        const messages = [
            {
                role: 'system',
                content: '당신은 유능한 한국어 AI 어시스턴트입니다. 모든 답변을 반드시 한국어로 작성하십시오.'
            }
        ];

        let userContent = "";
        if (context) {
            userContent = `[참고 문맥]\n${context}\n\n[사용자 질문]\n${userPrompt}\n\n위 [참고 문맥]을 활용하여 질문에 답변해 주세요. 답변은 반드시 한국어로 작성해야 합니다.`;
        } else {
            userContent = `${userPrompt}\n\n답변은 반드시 한국어로 작성해 주세요.`;
        }

        messages.push({
            role: 'user',
            content: userContent
        });

        const response = await axios({
            method: 'post',
            url: `${SLM_URL}/v1/chat/completions`,
            data: {
                model: 'qwen',
                messages: messages,
                stream: true,
                temperature: 0.3, // Lower temperature for more consistent language adherence
                max_tokens: 1024
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
                    // Ignore parsing errors
                }
            });
        });

    } catch (error) {
        console.error('Error in /api/chat:', error.message);
        res.status(500).json({ error: 'Model service error' });
    }
});

app.get('/health', (req, res) => res.send('OK'));

app.listen(PORT, () => {
    console.log(`Web UI listening on port ${PORT}`);
});
