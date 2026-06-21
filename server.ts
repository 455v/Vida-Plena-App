import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface ExtractedProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

app.post('/api/scan', async (req, res) => {
  const { image } = req.body as { image?: string };

  if (!image) {
    res.status(400).json({ error: 'Se requiere el campo "image" en Base64.' });
    return;
  }

  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
          {
            text: `Analiza esta imagen y extrae todos los productos visibles con su cantidad y unidad de medida.
Responde ÚNICAMENTE con un JSON válido con este formato, sin texto adicional:
{
  "productos": [
    { "nombre": "string", "cantidad": number, "unidad": "string" }
  ]
}`,
          },
        ],
      },
    ],
  });

  const text = response.text ?? '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    res.status(500).json({ error: 'No se pudo extraer JSON de la respuesta del modelo.' });
    return;
  }

  const parsed = JSON.parse(jsonMatch[0]) as { productos: ExtractedProduct[] };
  res.json(parsed);
});

const PORT = process.env.PORT ?? 4000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
