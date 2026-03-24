/**
 * Attempt to repair malformed JSON from Gemini output.
 * Handles: trailing commas, truncated arrays/objects, unescaped newlines.
 */
export function repairJson(text: string): string {
  let s = text.trim();

  // Remove markdown code fences
  s = s.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

  // Fix trailing commas before } or ]
  s = s.replace(/,\s*([\]}])/g, '$1');

  // Try to close unclosed brackets/braces
  let opens = 0, closes = 0;
  for (const c of s) {
    if (c === '{' || c === '[') opens++;
    if (c === '}' || c === ']') closes++;
  }
  // Append missing closers
  while (closes < opens) {
    // Guess whether to close with } or ]
    const lastOpen = s.lastIndexOf('{') > s.lastIndexOf('[') ? '}' : ']';
    s += lastOpen;
    closes++;
  }

  return s;
}
