import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import fs from 'fs';
import path from 'path';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const DATA_DIR = path.join(process.cwd(), 'data');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

if (!fs.existsSync(HISTORY_FILE)) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify([], null, 2));
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, DATA_DIR);
  },
  filename: (req, file, cb) => {
    const fileId = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    req.fileId = fileId;
    const ext = path.extname(file.originalname);
    cb(null, fileId + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const getGroqClient = (req) => {
  const apiKey = req.headers['x-api-key'] || process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('API_KEY_MISSING');
  return new Groq({ apiKey });
};

const readHistory = () => {
  try {
    const data = fs.readFileSync(HISTORY_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
};

const writeHistory = (history) => {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/history', (req, res) => {
  const history = readHistory();
  history.sort((a, b) => b.timestamp - a.timestamp);
  res.json(history);
});

app.get('/api/file/:fileId', (req, res) => {
  const { fileId } = req.params;
  const history = readHistory();
  const docData = history.find(h => h.fileId === fileId);
  if (!docData) return res.status(404).send('Not found');

  const filePath = path.join(DATA_DIR, fileId + docData.extension);
  if (fs.existsSync(filePath)) {
    res.setHeader('Content-Type', docData.mimeType);
    res.sendFile(filePath);
  } else {
    res.status(404).send('File not found on disk');
  }
});

app.delete('/api/history/:fileId', (req, res) => {
  const { fileId } = req.params;
  let history = readHistory();
  const docData = history.find(h => h.fileId === fileId);
  if (!docData) return res.status(404).json({ error: 'Not found' });

  history = history.filter(h => h.fileId !== fileId);
  writeHistory(history);

  try {
    const filePath = path.join(DATA_DIR, fileId + docData.extension);
    const textPath = path.join(DATA_DIR, fileId + '_text.txt');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (fs.existsSync(textPath)) fs.unlinkSync(textPath);
  } catch(e) {}

  res.json({ success: true });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    const mime = req.file.mimetype;
    const isPDF = mime === 'application/pdf';
    const isWord = mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isExcel = mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || mime === 'application/vnd.ms-excel';
    const isText = mime === 'text/plain';
    const isImage = mime.startsWith('image/');
    
    if (!isPDF && !isWord && !isExcel && !isText && !isImage) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Unsupported file type.' });
    }

    console.log(`Received file: ${req.file.originalname} (${req.file.size} bytes) [${mime}]`);

    let documentText = '';
    let groq;
    try {
      groq = getGroqClient(req);
    } catch (apiKeyError) {
      fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: 'Groq API Key is missing.', code: 'API_KEY_MISSING' });
    }

    try {
      const fileBuffer = fs.readFileSync(req.file.path);

      if (isPDF) {
        const pdfData = await pdfParse(fileBuffer);
        documentText = pdfData.text.trim();
      } else if (isWord) {
        const result = await mammoth.extractRawText({ buffer: fileBuffer });
        documentText = result.value.trim();
      } else if (isExcel) {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        for (const sheetName of sheetNames) {
          const sheet = workbook.Sheets[sheetName];
          documentText += `\n--- Sheet: ${sheetName} ---\n`;
          documentText += xlsx.utils.sheet_to_csv(sheet);
        }
        documentText = documentText.trim();
      } else if (isText) {
        documentText = fileBuffer.toString('utf-8').trim();
      } else if (isImage) {
        const base64Image = fileBuffer.toString('base64');
        const visionCompletion = await groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Transcribe all the text in this image accurately. Do not add any conversational filler, just output the exact text found in the image.' },
                { type: 'image_url', image_url: { url: `data:${mime};base64,${base64Image}` } }
              ]
            }
          ],
          model: 'llama-3.2-90b-vision-preview',
          temperature: 0.1,
        });
        documentText = visionCompletion.choices[0].message.content.trim();
      }
    } catch (parseError) {
      console.error('File parsing error:', parseError);
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Failed to extract text from the file.' });
    }

    if (!documentText) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Extracted text is empty or could not be found.' });
    }

    console.log(`Successfully extracted ${documentText.length} characters of text.`);
    
    const fileId = req.fileId;
    fs.writeFileSync(path.join(DATA_DIR, fileId + '_text.txt'), documentText);

    const prompt = `You are an expert document analyzer. Analyze the following extracted text from a document.
Provide your analysis strictly in JSON format. The response must be a single JSON object.
Use the following keys:
- documentType: A short classification (e.g. "Invoice", "Receipt", "Resume", "Contract", "Technical Report", "Manual", "Research Paper", "Unknown").
- summary: A concise, beautifully structured markdown summary. Always use clear section titles (e.g. ### Overview, ### Key Highlights) and put every bullet point on its own new line starting with "- ". Never format bullet items inline on a single line.
- entities: An array of key-value pairs, where each item is { "key": "entity name", "value": "extracted value" }. Focus on critical identifiers (e.g., dates, names, totals, reference numbers, companies, key items, topics, contact info).
- confidence: A percentage integer (0-100) representing how confident you are in this extraction.

Extracted Document Text:
---
${documentText.slice(0, 15000)}
---
Note: If the text was truncated, analyze the provided slice.`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      temperature: 0.2,
    });

    const responseText = completion.choices[0].message.content;
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseText);
    } catch (jsonError) {
      analysisResult = { documentType: 'Unknown', summary: 'Error parsing summary.', entities: [], confidence: 0 };
    }

    const history = readHistory();
    const newEntry = {
      fileId,
      filename: req.file.originalname,
      mimeType: mime,
      extension: path.extname(req.file.originalname),
      analysis: analysisResult,
      fileSize: req.file.size,
      timestamp: Date.now()
    };
    history.push(newEntry);
    writeHistory(history);

    res.json(newEntry);
  } catch (error) {
    console.error('Server error:', error);
    try { fs.writeFileSync('error.txt', String(error.stack || error)); } catch(e) {}
    if (error.status === 429 || error.status === 413) return res.status(429).json({ error: 'Groq API rate limit or context length reached. Please try a smaller file or try again later.' });
    res.status(500).json({ error: 'An unexpected error occurred.' });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { fileId, message } = req.body;
    if (!fileId || !message) return res.status(400).json({ error: 'Missing fileId or message.' });

    const history = readHistory();
    const docData = history.find(h => h.fileId === fileId);
    if (!docData) return res.status(404).json({ error: 'Document session expired or not found.' });

    let groq;
    try {
      groq = getGroqClient(req);
    } catch (e) {
      return res.status(401).json({ error: 'Groq API Key is missing.' });
    }
    
    let documentText = '';
    const textPath = path.join(DATA_DIR, fileId + '_text.txt');
    if (fs.existsSync(textPath)) {
      documentText = fs.readFileSync(textPath, 'utf-8');
    } else {
      return res.status(404).json({ error: 'Extracted text not found on server.' });
    }

    const systemPrompt = `You are an AI assistant helping a user analyze a document named "${docData.filename}".
Use the following extracted document text as your primary context to answer the user's question.
If the answer cannot be found in the text, politely state that the document does not contain that information.
Keep your answers clear, accurate, and concise.

FORMATTING REQUIREMENTS:
- Always format your answers using clean Markdown with distinct section headings (e.g., ### Key Findings) and structured bulleted lists.
- EVERY bullet point MUST be placed on its OWN NEW LINE starting with "- ". Never join multiple bullet points onto the same line or use inline asterisks like "* item1 * item2".
- When asked for lists, classes, features, steps, or key points, ALWAYS format them as clean bulleted or numbered lists with each item on a separate line.

Document Text:
---
${documentText.slice(0, 15000)}
---`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
    });

    res.json({ reply: completion.choices[0].message.content });
  } catch (error) {
    console.error('Chat error:', error);
    if (error.status === 429) return res.status(429).json({ error: 'Groq API rate limit reached.' });
    res.status(500).json({ error: 'An unexpected error occurred during chat processing.' });
  }
});

app.listen(port, '127.0.0.1', () => {
  console.log(`Backend server is running on http://127.0.0.1:${port}`);
});
