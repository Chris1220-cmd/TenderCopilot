import { isDocumentAIAvailable } from '../src/server/services/document-ai';

console.log('isDocumentAIAvailable:', isDocumentAIAvailable());
console.log('Expected: false (corrupt key, falls through to Gemini Vision)');
