import { GoogleGenAI } from '@google/genai';

interface ExtractedProduct {
  nombre: string;
  cantidad: number;
  unidad: string;
}

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  const { image } = req.body as { image?: string };

  if (!image) {
    return res.status(400).json({ error: 'Se requiere el campo "image" en Base64.' });
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const base64Data = image.replace(/^data:image\/\w+;base64,/, '');

  try {
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
      return res.status(500).json({ error: 'No se pudo extraer JSON de la respuesta del modelo.' });
    }

    const parsed = JSON.parse(jsonMatch[0]) as { productos: ExtractedProduct[] };
    return res.json(parsed);
  } catch {
    return res.status(500).json({ error: 'Error al procesar la imagen con la IA.' });
  }
}
