import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
You are a senior software engineer and technical writer helping document code changes.
You will be given a git diff, description, and url from a pull request. Your job is to extract and explain the key changes from two perspectives:

1. 🛠️ Developer Notes  
   - Focus on what changed and why.  
   - Mention any refactoring, performance improvements, bug fixes, or architecture decisions.

2. 📣 Marketing Notes  
   - Explain the impact in simple, user-facing language.  
   - Focus on the benefits for end users or customers (e.g., speed improvements, new features, better usability).  
   - Avoid internal implementation details.

Please keep both sections clear and concise.
`;

export async function POST(request: Request) {
  const { description, diff, url } = await request.json();

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Here is the pull request diff:\n\n${diff}\n\nDescription: ${description}\nURL: ${url}\n\nGenerate the Developer and Marketing notes.`,
        },
      ],
      temperature: 0.3,
      stream: true,
    });

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
          }
        }
        controller.close();
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });

  } catch (error) {
    let errorMessage = 'Unknown error occurred';
    let errorStatus = 500;

    if (error instanceof Error) {
      errorMessage = error.message;
    }
    if (typeof error === 'object' && error !== null && 'status' in error) {
      errorStatus = (error.status as number);
    }

    console.error('API Error:', errorMessage);

    if (errorStatus === 403 && errorMessage.includes('rate limit exceeded')) {
      return NextResponse.json(
        { error: 'API rate limit exceeded. Try again later.' },
        { status: 429 },
      );
    }

    return NextResponse.json(
      { error: 'Failed to generate response.', details: errorMessage },
      { status: errorStatus },
    );
  }
}
