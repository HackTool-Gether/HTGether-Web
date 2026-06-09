// Static knowledge base of common vulnerability tags (OWASP Top 10 2021 + frequent CWEs)
// used to power the smart autocomplete in the finding editor.
// `keywords` drives the fuzzy search (e.g. typing "xss" surfaces CWE-79).

export interface VulnTag {
  tag: string; // canonical value inserted into the finding (e.g. "CWE-79")
  label: string; // human-readable name shown in the suggestion list
  source: 'OWASP' | 'CWE';
  keywords: string[];
}

export const VULN_TAGS: VulnTag[] = [
  // --- OWASP Top 10 2021 ---
  { tag: 'OWASP-A01', label: 'Broken Access Control', source: 'OWASP', keywords: ['access control', 'idor', 'authorization', 'broken access', 'privilege', 'acl'] },
  { tag: 'OWASP-A02', label: 'Cryptographic Failures', source: 'OWASP', keywords: ['crypto', 'cryptographic', 'encryption', 'tls', 'ssl', 'cleartext', 'hashing'] },
  { tag: 'OWASP-A03', label: 'Injection', source: 'OWASP', keywords: ['injection', 'sqli', 'sql', 'xss', 'command injection', 'ldap'] },
  { tag: 'OWASP-A04', label: 'Insecure Design', source: 'OWASP', keywords: ['insecure design', 'design', 'threat modeling', 'business logic'] },
  { tag: 'OWASP-A05', label: 'Security Misconfiguration', source: 'OWASP', keywords: ['misconfiguration', 'config', 'hardening', 'default', 'headers', 'cors'] },
  { tag: 'OWASP-A06', label: 'Vulnerable and Outdated Components', source: 'OWASP', keywords: ['outdated', 'component', 'dependency', 'cve', 'vulnerable library', 'sca'] },
  { tag: 'OWASP-A07', label: 'Identification and Authentication Failures', source: 'OWASP', keywords: ['authentication', 'auth', 'session', 'brute force', 'mfa', 'credential'] },
  { tag: 'OWASP-A08', label: 'Software and Data Integrity Failures', source: 'OWASP', keywords: ['integrity', 'deserialization', 'supply chain', 'ci/cd', 'update'] },
  { tag: 'OWASP-A09', label: 'Security Logging and Monitoring Failures', source: 'OWASP', keywords: ['logging', 'monitoring', 'audit log', 'detection'] },
  { tag: 'OWASP-A10', label: 'Server-Side Request Forgery (SSRF)', source: 'OWASP', keywords: ['ssrf', 'request forgery', 'server-side request'] },

  // --- Frequent CWEs ---
  { tag: 'CWE-79', label: 'Cross-Site Scripting (XSS)', source: 'CWE', keywords: ['xss', 'cross-site scripting', 'cross site scripting', 'reflected', 'stored', 'dom'] },
  { tag: 'CWE-89', label: 'SQL Injection', source: 'CWE', keywords: ['sqli', 'sql injection', 'sql', 'injection'] },
  { tag: 'CWE-78', label: 'OS Command Injection', source: 'CWE', keywords: ['command injection', 'os command', 'rce', 'shell'] },
  { tag: 'CWE-352', label: 'Cross-Site Request Forgery (CSRF)', source: 'CWE', keywords: ['csrf', 'request forgery', 'cross-site request'] },
  { tag: 'CWE-22', label: 'Path Traversal', source: 'CWE', keywords: ['path traversal', 'directory traversal', 'lfi', 'file inclusion', '../'] },
  { tag: 'CWE-918', label: 'Server-Side Request Forgery (SSRF)', source: 'CWE', keywords: ['ssrf', 'request forgery'] },
  { tag: 'CWE-287', label: 'Improper Authentication', source: 'CWE', keywords: ['authentication', 'auth bypass', 'login'] },
  { tag: 'CWE-862', label: 'Missing Authorization', source: 'CWE', keywords: ['authorization', 'missing authorization', 'access control'] },
  { tag: 'CWE-863', label: 'Incorrect Authorization', source: 'CWE', keywords: ['authorization', 'idor', 'broken access'] },
  { tag: 'CWE-639', label: 'Authorization Bypass Through User-Controlled Key (IDOR)', source: 'CWE', keywords: ['idor', 'insecure direct object reference', 'authorization bypass'] },
  { tag: 'CWE-200', label: 'Exposure of Sensitive Information', source: 'CWE', keywords: ['information disclosure', 'sensitive information', 'data exposure', 'leak'] },
  { tag: 'CWE-311', label: 'Missing Encryption of Sensitive Data', source: 'CWE', keywords: ['encryption', 'cleartext', 'plaintext', 'crypto'] },
  { tag: 'CWE-798', label: 'Use of Hard-coded Credentials', source: 'CWE', keywords: ['hardcoded', 'hard-coded', 'credential', 'secret', 'api key'] },
  { tag: 'CWE-502', label: 'Deserialization of Untrusted Data', source: 'CWE', keywords: ['deserialization', 'unserialize', 'gadget'] },
  { tag: 'CWE-611', label: 'XML External Entity (XXE)', source: 'CWE', keywords: ['xxe', 'xml external entity', 'xml'] },
  { tag: 'CWE-434', label: 'Unrestricted Upload of File with Dangerous Type', source: 'CWE', keywords: ['file upload', 'upload', 'webshell'] },
  { tag: 'CWE-601', label: 'Open Redirect', source: 'CWE', keywords: ['open redirect', 'redirect', 'url redirection'] },
  { tag: 'CWE-1021', label: 'Clickjacking', source: 'CWE', keywords: ['clickjacking', 'ui redress', 'frame'] },
  { tag: 'CWE-209', label: 'Generation of Error Message Containing Sensitive Information', source: 'CWE', keywords: ['error message', 'stack trace', 'verbose error'] },
  { tag: 'CWE-307', label: 'Improper Restriction of Excessive Authentication Attempts', source: 'CWE', keywords: ['brute force', 'rate limit', 'login attempts'] },
  { tag: 'CWE-16', label: 'Security Misconfiguration', source: 'CWE', keywords: ['misconfiguration', 'config', 'headers'] },
];

// Returns up to `limit` tags matching the query against tag name, label, or keywords.
export function searchVulnTags(query: string, limit = 8): VulnTag[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { tag: VulnTag; score: number }[] = [];
  for (const t of VULN_TAGS) {
    const tagLower = t.tag.toLowerCase();
    const labelLower = t.label.toLowerCase();
    let score = -1;
    if (tagLower === q) score = 100;
    else if (t.keywords.some((k) => k === q)) score = 90;
    else if (tagLower.startsWith(q)) score = 80;
    else if (t.keywords.some((k) => k.startsWith(q))) score = 70;
    else if (labelLower.includes(q)) score = 50;
    else if (t.keywords.some((k) => k.includes(q))) score = 40;
    else if (tagLower.includes(q)) score = 30;
    if (score >= 0) scored.push({ tag: t, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.tag);
}
