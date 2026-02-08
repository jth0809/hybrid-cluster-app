from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import torch

app = FastAPI()
model = SentenceTransformer('all-MiniLM-L6-v2')

class EmbeddingRequest(BaseModel):
    input: str

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/v1/embeddings")
async def get_embeddings(request: EmbeddingRequest):
    embeddings = model.encode([request.input])
    return {
        "object": "list",
        "data": [
            {
                "object": "embedding",
                "embedding": embeddings[0].tolist(),
                "index": 0
            }
        ],
        "model": "all-MiniLM-L6-v2"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
