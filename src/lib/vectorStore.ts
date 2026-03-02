import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Pinecone
const pc = new Pinecone({
  apiKey: import.meta.env.VITE_PINECONE_API_KEY,
});

// Target your specific index
export const pineconeIndex = pc.index(import.meta.env.VITE_PINECONE_INDEX_NAME);
