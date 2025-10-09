# AI-Assisted Code Review Process

This document defines the standard review flow for Law Transcribed. It captures how we leverage AI-powered tooling together with deep manual expertise to keep production-grade quality.

## 1. Review Preparation
- **Gather context**: read the pull request description, related tickets, and architectural notes.
- **Identify scope**: confirm the directories touched and check for relevant AGENTS.md instructions.
- **Sync environment**: pull the latest `work` branch, install dependencies, and run a clean build/test baseline.

## 2. Automated Analysis
1. **Static analysis suite**
   - `pnpm lint` (ESLint) with project rules.
   - `pnpm typecheck` for TypeScript validation.
   - `pnpm test -- --runInBand` for targeted regression coverage.
2. **Security scanning**
   - Run `pnpm dlx snyk test` on modified packages when dependencies change.
   - Execute `pnpm audit --prod` for dependency CVEs.
3. **Custom Semgrep rules**
   - Use `pnpm semgrep --config .semgrep` to enforce security and privacy patterns.

Document any failures in the PR conversation before continuing.

## 3. AI-Powered Insights
- Use Copilot or Bito to summarize diff impacts and surface potential bugs or missing tests.
- For large diffs, run the Trag CLI reviewer to generate targeted questions.
- Feed suspicious snippets into LLM-based analyzers for alternative implementations or edge cases.

## 4. Manual Review Checklist
- ✅ **Correctness**: logic matches requirements, covers edge cases, and avoids regressions.
- ✅ **Security & Privacy**: no leakage of PII, credentials, or signing secrets. Verify input validation paths.
- ✅ **Performance**: watch for N+1 queries, unnecessary renders, or costly operations.
- ✅ **Resilience**: confirm error handling, retries, and logging in critical paths.
- ✅ **Tests**: ensure new functionality is covered by unit/e2e tests with meaningful assertions.
- ✅ **Maintainability**: check naming, modularity, and adherence to local conventions.

## 5. Feedback Delivery
- Prioritize high-severity findings first (blocking issues).
- Provide actionable suggestions with example code when possible.
- Link to docs or previous decisions to reinforce learning.
- Highlight wins to encourage positive practices.

## 6. Approval & Follow-Up
- Approve only when automated checks pass and manual concerns are resolved.
- Capture recurring issues as new Semgrep/ESLint rules or checklist items.
- Schedule post-merge validation for risky changes (feature flags, shadow deployments, etc.).

---
Maintaining this workflow ensures every change merges with production-level confidence and shared understanding across the team.
