import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { city, temperature, condition } = await request.json();

  const prompt = `You are a hilarious Pokédex narrator. Write ONE short, funny sentence (max 18 words) in Pokédex style about the weather in ${city} right now: ${temperature}°C (${condition}). Mention the Pokémon types playfully.`;

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama3-8b-8192',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 60,
      temperature: 0.9,
    }),
  });

  const data = await res.json();
  const flavor = data.choices?.[0]?.message?.content || "The wild Pokémon are loving this weather!";

  return NextResponse.json({ flavor });
}