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
            model: 'all-MiniLM-L6-v2'
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
        let prompt = req.body.prompt;
        const context = await getContext(prompt);

        // Refined personality-driven prompt
        if (context) {
            prompt = `당신은 사용자의 질문에 친절하고 상세하게 답변하는 유능한 AI 어시스턴트입니다. 
아래에 제공된 [참고 문맥]이 질문과 관련이 있다면 이를 적극 활용하여 답변을 구성해 주세요. 
만약 문맥에 직접적인 답이 없더라도, 당신이 가진 지식을 총동원하여 자연스럽고 풍부하게 대화를 이어가 주세요. 
단순히 문맥을 반복하기보다는 당신의 언어로 친절하게 설명해 주는 것이 중요합니다.
답변은 반드시 한국어로 작성해 주세요.

[참고 문맥]
${context}

[사용자 질문]: ${prompt}
[AI 답변]:`;
        }

        const response = await axios({
            method: 'post',
            url: `${SLM_URL}/v1/chat/completions`,
            data: {
                model: 'google/gemma-3-1b-it',
                messages: [{ role: 'user', content: prompt }],
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
