import { NextResponse } from "next/server";
import { fixFullTextRuleBased } from "@/lib/autocorrect";

interface GrammarMatch {
  message: string;
  offset: number;
  length: number;
  replacement: string;
}

async function fixWithLanguageTool(text: string): Promise<{ corrected: string; count: number }> {
  if (!text || text.trim().length === 0) {
    return { corrected: text, count: 0 };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const body = new URLSearchParams();
    body.append("text", text);
    body.append("language", "en-US");

    const res = await fetch("https://api.languagetool.org/v2/check", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return fixFullTextRuleBased(text);
    }

    const data = await res.json();
    const matches: GrammarMatch[] = [];

    for (const m of data.matches || []) {
      if (m.replacements && m.replacements.length > 0) {
        matches.push({
          message: m.message,
          offset: m.offset,
          length: m.length,
          replacement: m.replacements[0].value,
        });
      }
    }

    if (matches.length === 0) {
      // Run local rules for any remaining common typos
      return fixFullTextRuleBased(text);
    }

    // Sort matches from right to left to avoid offsetting replacement indices
    matches.sort((a, b) => b.offset - a.offset);

    let corrected = text;
    for (const match of matches) {
      corrected =
        corrected.slice(0, match.offset) +
        match.replacement +
        corrected.slice(match.offset + match.length);
    }

    // Also run rules for capitalization and spacing
    const ruleResult = fixFullTextRuleBased(corrected);

    return {
      corrected: ruleResult.corrected,
      count: matches.length + ruleResult.count,
    };
  } catch {
    // If LanguageTool API is unreachable, fall back to offline rule-based dictionary
    return fixFullTextRuleBased(text);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // 1. Single text string mode
    if (typeof body.text === "string") {
      const result = await fixWithLanguageTool(body.text);
      return NextResponse.json({
        corrected: result.corrected,
        count: result.count,
      });
    }

    // 2. Full document blocks mode
    if (Array.isArray(body.blocks)) {
      let totalChanges = 0;
      const updatedBlocks = await Promise.all(
        body.blocks.map(async (block: { id: string; text?: string; [key: string]: any }) => {
          if (block.text && typeof block.text === "string" && block.type !== "code") {
            const { corrected, count } = await fixWithLanguageTool(block.text);
            totalChanges += count;
            return { ...block, text: corrected };
          }
          return block;
        })
      );

      let correctedTitle = body.title;
      if (typeof body.title === "string" && body.title.trim().length > 0) {
        const titleRes = await fixWithLanguageTool(body.title);
        correctedTitle = titleRes.corrected;
        totalChanges += titleRes.count;
      }

      return NextResponse.json({
        title: correctedTitle,
        blocks: updatedBlocks,
        totalChanges,
      });
    }

    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
