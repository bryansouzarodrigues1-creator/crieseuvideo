// Keyword bank: maps script words to a fixed visual cue so the AI never guesses (e.g. "link da bio" is a profile, not WhatsApp).
export type Cue = { tag: string; words: string[]; hint: string };

export const KEYWORD_BANK: Cue[] = [
  { tag: "CTA_BIO", words: ["bio", "link na bio", "link da bio", "perfil", "seguir", "siga", "arrasta pra cima"], hint: "visual profile (perfil com LINK NA BIO). NUNCA phone_chat/WhatsApp." },
  { tag: "CHAT", words: ["whatsapp", "mensagem", "conversa", "chat", "direct", "dm"], hint: "phone com balões de conversa (visual phone_chat)." },
  { tag: "WEBSITE", words: ["site", "página", "pagina", "landing", "loja virtual", "internet"], hint: "laptop com site sendo montado." },
  { tag: "MONEY", words: ["dinheiro", "renda", "lucro", "faturar", "ganhar", "vender", "venda", "reais", "r$"], hint: "coin/money grandes, chart subindo." },
  { tag: "TIME", words: ["tempo", "horas", "dias", "meses", "rápido", "rapido", "depois"], hint: "clock grande correndo." },
  { tag: "COMPARE", words: ["preço", "preco", "barato", "caro", "comparar", "melhor que", "vs"], hint: "scale (balança) comparando." },
  { tag: "LOCAL", words: ["bairro", "cidade", "mapa", "loja", "local", "perto"], hint: "pin caindo no mapa ou skyline." },
  { tag: "WRONG", words: ["erro", "errado", "não faça", "nao faca", "nunca", "pare"], hint: "xmark vermelho carimbado." },
  { tag: "RIGHT", words: ["certo", "faça", "faca", "sempre", "dica", "pronto"], hint: "check verde carimbado." },
  { tag: "PEOPLE", words: ["clientes", "pessoas", "público", "publico", "seguidores"], hint: "crowd (multidão)." },
];

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function detectCues(text: string): Cue[] {
  const t = ` ${norm(text)} `;
  return KEYWORD_BANK.filter((c) => c.words.some((w) => new RegExp(`(^|[^a-z0-9])${norm(w).replace(/[$]/g, "\\$")}([^a-z0-9]|$)`).test(t)));
}

export function cueRule(text: string): string {
  const cues = detectCues(text);
  return cues.length ? `PALAVRAS-CHAVE DETECTADAS (obrigatório seguir): ${cues.map((c) => `[${c.tag}] ${c.hint}`).join(" | ")}` : "";
}
