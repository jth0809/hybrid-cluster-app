import os
import requests
import json
import glob

# Configuration
# Internal K8s Service URLs (accessible from within the cluster)
QDRANT_HOST = "http://qdrant.default:6333"  # Using K8s DNS
EMBEDDING_HOST = "http://localhost:8000"    # Assuming running inside vllm-server pod (localhost) OR http://vllm-server:8000

# Collection Configuration
COLLECTION_NAME = "knowledge_base"
VECTOR_SIZE = 768  # gemma-3-1b/MiniLM usually 384, but let's check model. 
# NOTE: The implementation plan says "all-MiniLM-L6-v2" which is 384.
# If we use vLLM's `google/gemma-3-1b-it` for embeddings, the size might differ (e.g. 2048 or 768).
# However, the previous script used `all-MiniLM-L6-v2` via an "embedding-service".
# Let's stick to the existing embedding service endpoint if acceptable, OR use vLLM.
# The user's architecture shows vLLM typically handles chat. 
# `kubectl get svc` showed `embedding-service` (10.109.39.81) and `vllm-server` (10.96.178.11).
# I will use the `embedding-service` host defined in original script but update DNS.

EMBEDDING_HOST = "http://embedding-service.default:8000" 
# Use 384 for multilingual-MiniLM which is typical for 'embedding-service' images.
VECTOR_SIZE = 384 

def get_embedding(text):
    try:
        response = requests.post(
            f"{EMBEDDING_HOST}/v1/embeddings",
            json={"model": "all-MiniLM-L6-v2", "input": text},
            timeout=10
        )
        response.raise_for_status()
        return response.json()["data"][0]["embedding"]
    except Exception as e:
        print(f"Error getting embedding: {e}")
        return None

def init_collection():
    print(f"Checking collection {COLLECTION_NAME}...")
    try:
        response = requests.get(f"{QDRANT_HOST}/collections/{COLLECTION_NAME}")
        if response.status_code == 200:
             print(f"Collection {COLLECTION_NAME} exists. Recreating to ensure schema...")
             requests.delete(f"{QDRANT_HOST}/collections/{COLLECTION_NAME}")
        
        print(f"Creating collection {COLLECTION_NAME} with vector size {VECTOR_SIZE}...")
        requests.put(
            f"{QDRANT_HOST}/collections/{COLLECTION_NAME}",
            json={
                "vectors": {
                    "size": VECTOR_SIZE,
                    "distance": "Cosine"
                }
            }
        ).raise_for_status()
        print("Collection created successfully.")
    except Exception as e:
        print(f"Failed to init collection: {e}")
        exit(1)

def ingest_file(file_path):
    print(f"Processing {file_path}...")
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            
        # Naive chunking: Split by double newlines (paragraphs) to keep context
        chunks = [c.strip() for c in content.split("\n\n") if c.strip()]
        
        # Merge small chunks
        merged_chunks = []
        current_chunk = ""
        for chunk in chunks:
            if len(current_chunk) + len(chunk) < 500:
                current_chunk += "\n" + chunk
            else:
                if current_chunk: merged_chunks.append(current_chunk)
                current_chunk = chunk
        if current_chunk: merged_chunks.append(current_chunk)
        
        for i, text in enumerate(merged_chunks):
            vector = get_embedding(text)
            if not vector: continue
            
            # Upsert
            point_id = hash(f"{file_path}_{i}") % (2**64) # Qdrant requires uint64 or UUID
            # Python hash can be negative, ensure positive for ID if using integer
            point_id = abs(point_id) 
            
            requests.put(
                f"{QDRANT_HOST}/collections/{COLLECTION_NAME}/points",
                json={
                    "points": [
                        {
                            "id": point_id,
                            "vector": vector,
                            "payload": {"text": text, "source": os.path.basename(file_path)}
                        }
                    ]
                }
            ).raise_for_status()
            print(f"  Indexed chunk {i} ({len(text)} chars)")
            
    except Exception as e:
        print(f"Failed to ingest {file_path}: {e}")

if __name__ == "__main__":
    init_collection()
    
    # Ingest all .md and .txt files in /data directory
    target_files = glob.glob("/data/*.md") + glob.glob("/data/*.txt")
    
    if not target_files:
        print("No .md or .txt files found in /data")
    else:
        for f in target_files:
            ingest_file(f)
            
    print("Ingestion flow finished.")
