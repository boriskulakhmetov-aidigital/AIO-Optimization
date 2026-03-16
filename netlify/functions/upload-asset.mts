import { GoogleGenAI } from '@google/genai';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

export default async (req: Request) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 });
  }
  if (file.size > MAX_SIZE) {
    return Response.json({ error: 'File too large (max 8 MB)' }, { status: 413 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Response.json({ error: 'Unsupported file type. Use JPEG, PNG, GIF, or WebP.' }, { status: 400 });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const uploaded = await ai.files.upload({
      file,
      config: { mimeType: file.type, displayName: file.name },
    });

    return Response.json({
      fileUri: uploaded.uri,
      mimeType: file.type,
      fileName: file.name,
    });
  } catch (err) {
    console.error('Gemini file upload error:', err);
    return Response.json({ error: 'Failed to upload asset' }, { status: 500 });
  }
};
