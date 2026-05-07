// ============================================================
// services/ai.js — Integração com Groq
// ============================================================

const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function melhorarTextoComIA(secao, texto) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'Você é um especialista em redação técnica e acadêmica brasileira. ' +
            'Responda APENAS com o texto melhorado, sem explicações, sem aspas, sem prefixos.',
        },
        {
          role: 'user',
          content:
            `Melhore o texto abaixo da seção "${secao}" de um relatório técnico.\n\n` +
            `Aplique: linguagem formal, correção gramatical, estilo acadêmico (ABNT), ` +
            `mantenha todas as informações originais, não invente dados.\n\n` +
            `Texto:\n${texto}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 1024,
    });

    return completion.choices[0].message.content.trim();
  } catch (error) {
    if (error.status === 401) throw new Error('Chave GROQ_API_KEY inválida.');
    if (error.status === 429) throw new Error('Limite do Groq atingido. Tente em instantes.');
    throw new Error(`Erro Groq: ${error.message}`);
  }
}

module.exports = { melhorarTextoComIA };
