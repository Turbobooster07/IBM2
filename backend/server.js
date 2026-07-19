import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Set up multer memory storage for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Server-side cache for analyzed documents (using Map for simplicity)
const documentCache = new Map();

// Helper to initialize Groq client
const getGroqClient = (req) => {
  const apiKey = req.headers['x-api-key'] || process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }
  return new Groq({ apiKey });
};

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// PDF Ingestion and Analysis Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'Only PDF files are supported.' });
    }

    console.log(`Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the PDF
    let pdfData;
    try {
      pdfData = await pdfParse(req.file.buffer);
    } catch (parseError) {
      console.error('PDF parsing error:', parseError);
      return res.status(400).json({ error: 'Failed to extract text from PDF. The file may be corrupt or scanned.' });
    }

    const documentText = pdfData.text.trim();
    if (!documentText) {
      return res.status(400).json({ error: 'Extracted text is empty. This PDF might contain only images/scans.' });
    }

    console.log(`Successfully extracted ${documentText.length} characters of text.`);

    // Initialize Groq client
    let groq;
    try {
      groq = getGroqClient(req);
    } catch (apiKeyError) {
      return res.status(401).json({
        error: 'Groq API Key is missing. Please provide it in the API Key Settings.',
        code: 'API_KEY_MISSING'
      });
    }

    const prompt = `You are an expert document analyzer. Analyze the following extracted text from a PDF document.
Provide your analysis strictly in JSON format. The response must be a single JSON object.
Use the following keys:
- documentType: A short classification (e.g. "Invoice", "Receipt", "Resume", "Contract", "Technical Report", "Manual", "Research Paper", "Unknown").
- summary: A concise, structured bulleted markdown summary of the document's core content.
- entities: An array of key-value pairs, where each item is { "key": "entity name", "value": "extracted value" }. Focus on critical identifiers (e.g., dates, names, totals, reference numbers, companies, key items, topics, contact info).
- confidence: A percentage integer (0-100) representing how confident you are in this extraction.

Extracted PDF Text:
---
${documentText.slice(0, 50000)}
---
Note: If the text was truncated, analyze the provided slice.`;

    console.log('Sending text to Groq for initial analysis...');
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const responseText = completion.choices[0].message.content;
    console.log('Groq analysis complete.');

    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (jsonError) {
      console.error('Error parsing Groq JSON response:', responseText);
      analysisResult = {
        documentType: 'Unknown',
        summary: 'Error parsing summary details.',
        entities: [],
        confidence: 0
      };
    }

    // Generate a unique file ID
    const fileId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

    // Store in cache
    const cacheData = {
      filename: req.file.originalname,
      text: documentText,
      analysis: analysisResult,
      timestamp: Date.now()
    };
    documentCache.set(fileId, cacheData);

    // Clean up cache if it gets too large (> 50 documents)
    if (documentCache.size > 50) {
      const oldestKey = documentCache.keys().next().value;
      documentCache.delete(oldestKey);
    }

    res.json({
      fileId,
      filename: req.file.originalname,
      analysis: analysisResult,
    });

  } catch (error) {
    console.error('Server error during upload:', error);
    if (error.status === 429) {
      return res.status(429).json({ error: 'Groq API rate limit reached. Please wait a moment and try again.' });
    }
    res.status(500).json({ error: 'An unexpected error occurred on the server.' });
  }
});

// PDF Chat/Q&A Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { fileId, message, chatHistory } = req.body;

    if (!fileId || !message) {
      return res.status(400).json({ error: 'Missing fileId or message.' });
    }

    const docData = documentCache.get(fileId);
    if (!docData) {
      return res.status(404).json({ error: 'Document session expired or not found. Please upload the PDF again.' });
    }

    // Initialize Groq client
    let groq;
    try {
      groq = getGroqClient(req);
    } catch (apiKeyError) {
      return res.status(401).json({
        error: 'Groq API Key is missing. Please check your settings.',
        code: 'API_KEY_MISSING'
      });
    }

    const systemPrompt = `You are an AI assistant helping a user analyze a PDF document named "${docData.filename}".
Use the following extracted document text as your primary context to answer the user's question.
If the answer cannot be found in the text, politely state that the document does not contain that information.
Keep your answers clear, accurate, and concise.

Document Text:
---
${docData.text.slice(0, 80000)}
---`;

    console.log(`Generating chat response for file: ${docData.filename}`);

    const completion = await groq.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
    });

    const responseText = completion.choices[0].message.content;

    res.json({ reply: responseText });

  } catch (error) {
    console.error('Server error during chat:', error);
    if (error.status === 429) {
      return res.status(429).json({ error: 'Groq API rate limit reached. Please wait a moment and try again.' });
    }
    res.status(500).json({ error: 'An unexpected error occurred during chat processing.' });
  }
});

app.listen(port, () => {
  console.log(`Backend server is running on port ${port}`);
});
