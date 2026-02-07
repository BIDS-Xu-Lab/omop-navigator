function extractAssistantText(result) {
  if (!result) return '';

  if (typeof result.finalOutput === 'string') return result.finalOutput;
  if (typeof result.output_text === 'string') return result.output_text;

  if (Array.isArray(result.finalOutput)) {
    return result.finalOutput
      .map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item?.text === 'string') return item.text;
        return '';
      })
      .join('\n')
      .trim();
  }

  if (Array.isArray(result.output)) {
    const textParts = [];
    for (const item of result.output) {
      if (typeof item?.content === 'string') {
        textParts.push(item.content);
        continue;
      }

      if (Array.isArray(item?.content)) {
        for (const chunk of item.content) {
          if (typeof chunk?.text === 'string') textParts.push(chunk.text);
        }
      }
    }
    return textParts.join('\n').trim();
  }

  return '';
}

function parseAgentJson(rawText) {
  const normalized = String(rawText || '').trim();
  if (!normalized) {
    return {
      assistant_response: 'No response from agent.',
      sql_cells: [],
    };
  }

  try {
    const direct = JSON.parse(normalized);
    if (direct && typeof direct === 'object') return direct;
  } catch {
    // Continue with fenced JSON extraction.
  }

  const fenced = normalized.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1]);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {
      // Fall back to plain text.
    }
  }

  return {
    assistant_response: normalized,
    sql_cells: [],
  };
}

export async function runOmopAgent({ apiKey, model, systemPrompt, userPrompt, omopContext }) {
  if (!apiKey) {
    throw new Error('OpenAI API key is required. Set it in Settings.');
  }

  const [{ Agent, run }, openaiAddon] = await Promise.all([
    import('@openai/agents'),
    import('@openai/agents-openai').catch(() => ({})),
  ]);

  const maybeSetKeyFns = [
    openaiAddon?.setDefaultOpenAIKey,
    openaiAddon?.setOpenAIAPIKey,
    openaiAddon?.setDefaultApiKey,
  ].filter((fn) => typeof fn === 'function');

  if (maybeSetKeyFns.length > 0) {
    maybeSetKeyFns[0](apiKey);
  }

  const agent = new Agent({
    name: 'OMOP DuckDB SQL Agent',
    model,
    instructions: `${systemPrompt}\n\nCurrent database context:\n${omopContext || 'No OMOP DB loaded yet.'}`,
  });

  const result = await run(agent, userPrompt);
  const rawText = extractAssistantText(result);
  const parsed = parseAgentJson(rawText);

  const assistantResponse = typeof parsed.assistant_response === 'string'
    ? parsed.assistant_response
    : 'Response generated.';

  const sqlCells = Array.isArray(parsed.sql_cells)
    ? parsed.sql_cells
        .map((cell) => ({
          title: String(cell?.title || 'SQL Cell'),
          sql: String(cell?.sql || '').trim(),
        }))
        .filter((cell) => cell.sql.length > 0)
    : [];

  return {
    assistantResponse,
    sqlCells,
    rawText,
  };
}
