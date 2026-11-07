// Função serverless (Vercel): recebe a pergunta, consulta o Gemini e devolve a resposta.
// A chave fica só no servidor (variável de ambiente GEMINI_API_KEY), nunca no navegador.
const { readFileSync } = require("node:fs");
const { join } = require("node:path");

const MODELO = process.env.GEMINI_MODEL || "gemini-3.1-flash"; // confira o nome atual no Google AI Studio
const PONTOS = readFileSync(join(process.cwd(), "ecopontos.json"), "utf-8");

const SISTEMA = `Você é o assistente virtual da EcoDev, projeto extensionista de uma faculdade que ajuda
moradores de São Paulo (foco: Terminal Santo Amaro) a descartar resíduos corretamente.

REGRAS:
- Responda em português do Brasil, linguagem simples e curta (máx. ~6 linhas).
- Use SOMENTE os dados abaixo para endereços, horários e o que cada ponto aceita.
- Se a informação não estiver nos dados, diga que não tem essa informação e sugira a Prefeitura (156).
  NUNCA invente endereço, horário, taxa ou regra.
- Para indicar o ponto mais próximo, peça que a pessoa use o botão de localização ou digite o CEP acima.
- Não peça nem guarde dados pessoais.
- Assuntos fora de descarte de resíduos: diga educadamente que só ajuda com isso.

DADOS DOS PONTOS (JSON):
${PONTOS}`;

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ erro: "Método não permitido." });
  const pergunta = String(req.body?.pergunta || "").trim().slice(0, 400);
  if (!pergunta) return res.status(400).json({ erro: "Escreva uma pergunta." });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ erro: "Servidor sem chave configurada." });

  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODELO}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [{ role: "user", parts: [{ text: pergunta }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 400 },
      }),
    });
    const d = await r.json();
    if (!r.ok) {
      console.error("Gemini:", JSON.stringify(d));
      return res.status(502).json({ erro: "O assistente está indisponível agora. Tente em instantes." });
    }
    const texto = d.candidates?.[0]?.content?.parts?.map((p) => p.text).join("").trim();
    return res.status(200).json({ resposta: texto || "Não consegui responder agora. Pode reformular?" });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ erro: "Erro no servidor. Tente de novo." });
  }
};
