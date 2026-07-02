const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "to",
  "in",
  "on",
  "for",
  "of",
  "with",
  "from",
  "at",
  "by",
  "is",
  "are",
  "be",
  "this",
  "that",
  "it",
  "as",
  "any",
  "only",
  "not",
  "do",
  "please",
  "need",
  "into",
  "проекта",
  "проекте",
  "проект",
  "файл",
  "файле",
  "код",
  "коде",
  "любую",
  "любой",
  "любая",
  "случайную",
  "случайный",
  "запись",
  "записи",
  "что",
  "как",
  "для",
  "при",
  "это",
  "этот",
  "эта",
  "и",
  "в",
  "на",
  "с",
  "по",
  "из",
  "не",
  "или",
  "а",
  "но",
  "же",
  "ли",
  "бы",
  "к",
  "у",
  "о",
  "об",
  "от",
  "до",
  "над",
  "под",
  "без",
  "через",
  "после",
  "перед",
  "между",
  "также",
  "тоже",
  "ещё",
  "еще",
  "уже",
  "все",
  "всё",
  "всего",
  "нужно",
  "надо",
  "можно",
  "должен",
  "должна",
  "должны",
]);

const ACTION_WORDS: Record<string, string> = {
  add: "add",
  create: "create",
  update: "update",
  fix: "fix",
  remove: "remove",
  delete: "delete",
  refactor: "refactor",
  improve: "improve",
  change: "change",
  implement: "implement",
  write: "write",
  append: "add",
  добавь: "add",
  добавить: "add",
  добавьте: "add",
  создай: "create",
  создать: "create",
  создайте: "create",
  обнови: "update",
  обновить: "update",
  обновите: "update",
  исправь: "fix",
  исправить: "fix",
  удали: "remove",
  удалить: "remove",
  измени: "change",
  изменить: "change",
  напиши: "write",
  сделай: "implement",
};

const BRANCH_PREFIX_WORDS = new Set([
  "feature",
  "hotfix",
  "refactor",
  "docs",
  "test",
  "chore",
]);

const PREFIX_RULES: Array<{ prefix: string; keywords: string[] }> = [
  {
    prefix: "hotfix",
    keywords: [
      "hotfix",
      "fix",
      "bug",
      "bugfix",
      "patch",
      "исправ",
      "баг",
      "ошибк",
      "сломан",
    ],
  },
  {
    prefix: "refactor",
    keywords: ["refactor", "рефактор", "перепис", "restructure"],
  },
  {
    prefix: "docs",
    keywords: [
      "docs",
      "documentation",
      "readme",
      "документ",
      "коммент",
      "описан",
    ],
  },
  {
    prefix: "test",
    keywords: ["test", "tests", "testing", "тест", "покрыт"],
  },
  {
    prefix: "chore",
    keywords: [
      "chore",
      "deps",
      "dependency",
      "dependencies",
      "зависимост",
      "обнови",
      "обновить",
      "ci",
      "build",
      "config",
    ],
  },
];

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "e",
  ж: "zh",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "h",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sch",
  ъ: "",
  ы: "y",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
};

export function buildBranchName(taskText: string, taskId: string): string {
  const prefix = detectBranchPrefix(taskText);
  const ticket = extractTicketId(taskText);
  const slug = buildSlug(taskText);
  const suffix = taskId.replace(/-/g, "").slice(0, 8);

  const descriptivePart =
    ticket === undefined ? slug : `${ticket.toLowerCase()}-${slug}`;

  return sanitizeBranchName(`${prefix}/${descriptivePart}-${suffix}`);
}

function detectBranchPrefix(taskText: string): string {
  const sources = [taskText.toLowerCase(), transliterate(taskText.toLowerCase())];

  for (const source of sources) {
    for (const rule of PREFIX_RULES) {
      if (rule.keywords.some((keyword) => containsKeyword(source, keyword))) {
        return rule.prefix;
      }
    }
  }

  return "feature";
}

function containsKeyword(text: string, keyword: string): boolean {
  const normalizedKeyword = keyword.toLowerCase();

  if (/^[a-z0-9-]+$/.test(normalizedKeyword)) {
    return new RegExp(`\\b${escapeRegExp(normalizedKeyword)}\\b`, "i").test(text);
  }

  return text.includes(normalizedKeyword);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractTicketId(taskText: string): string | undefined {
  const match = taskText.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);

  return match?.[1];
}

function buildSlug(taskText: string): string {
  const ticket = extractTicketId(taskText)?.toLowerCase();
  const tokens = tokenize(taskText);
  const parts: string[] = [];
  const used = new Set<string>();

  const action = tokens
    .map((token) => ACTION_WORDS[token])
    .find((value) => value !== undefined);

  if (action !== undefined && !BRANCH_PREFIX_WORDS.has(action)) {
    parts.push(action);
    used.add(action);
  }

  for (const token of tokens) {
    const normalizedToken = transliterate(token);

    if (
      ticket !== undefined &&
      (token.toLowerCase() === ticket || normalizedToken === ticket)
    ) {
      continue;
    }

    if (token.includes(".")) {
      const fileSlug = token
        .toLowerCase()
        .split(".")
        .filter((segment) => segment.length > 0)
        .map((segment) => transliterate(segment).replace(/[^a-z0-9]/g, ""))
        .filter((segment) => segment.length > 0)
        .join("-");

      if (fileSlug.length > 0 && !used.has(fileSlug)) {
        parts.push(fileSlug);
        used.add(fileSlug);
      }

      continue;
    }

    const slugToken = normalizedToken.replace(/[^a-z0-9]/g, "");

    if (
      slugToken.length < 3 ||
      STOP_WORDS.has(token) ||
      STOP_WORDS.has(slugToken) ||
      used.has(slugToken) ||
      ACTION_WORDS[token] !== undefined
    ) {
      continue;
    }

    if (slugToken === "hotfix" || BRANCH_PREFIX_WORDS.has(slugToken)) {
      continue;
    }

    parts.push(slugToken);
    used.add(slugToken);

    if (parts.length >= 4) {
      break;
    }
  }

  if (parts.length === 0) {
    return "ai-task";
  }

  return parts.join("-").slice(0, 48);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/[^a-zA-Z\u0430-\u044f\u0451\u0401\u0410-\u042f0-9._-]+/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}

function transliterate(text: string): string {
  return [...text]
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join("");
}

function sanitizeBranchName(branchName: string, maxLength = 80): string {
  const sanitized = branchName
    .toLowerCase()
    .replace(/[^a-z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^[-/]+|[-/]+$/g, "");

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  const prefixEnd = sanitized.indexOf("/");
  const prefix =
    prefixEnd === -1 ? "feature" : sanitized.slice(0, prefixEnd);
  const remainder = sanitized.slice(prefixEnd + 1);
  const allowedRemainderLength = Math.max(
    12,
    maxLength - prefix.length - 1,
  );

  return `${prefix}/${remainder.slice(0, allowedRemainderLength).replace(/-+$/g, "")}`;
}
