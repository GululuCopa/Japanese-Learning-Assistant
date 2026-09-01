# Japanese Learning Assistant V0.1 for Windows — Context

**Status:** READY_FOR_EXECUTION  
**Date:** 2026-09-01  
**Baseline commit:** `8e465febcde349901c9cb8ba8d0e8a04d3dc1173`

## Objective

Build the complete V0.1 desktop application described by `docs/PRD.md`, with Windows 10/11 x64 as a supported first-class target. Deliver the closed loop:

`text/screenshot -> structured Japanese explanation -> pronunciation -> save -> history/notes -> Obsidian export`.

## Repository Evidence

At the recorded baseline:

- The repository contains only `docs/PRD.md`.
- There is no application source, package manifest, test suite, build configuration, or CI configuration.
- Current behavior is therefore documentation-only; none of the V0.1 Definition of Done cases is implemented.
- The baseline was created after explicit user approval.

Reproduction:

```bash
git show --stat 8e465febcde349901c9cb8ba8d0e8a04d3dc1173
git ls-tree -r --name-only 8e465febcde349901c9cb8ba8d0e8a04d3dc1173
```

## Approved Decisions

The user approved these decisions on 2026-09-01:

1. Initialize Git and use the existing PRD as the baseline.
2. Use Electron, React, TypeScript, and SQLite.
3. Implement the full PRD V0.1 rather than only Phase 1.
4. Support Windows 10/11 x64.
5. Implement an OpenAI-compatible AI provider and an OpenAI-compatible TTS provider behind abstractions.
6. Keep API keys local and never commit them.
7. Use the right-side Herdr Grok agent running Grok 4.6 with xhigh reasoning as the only implementation writer.

## In Scope

- Electron desktop shell and secure preload bridge.
- React chat, notes, history, and settings pages.
- Text, clipboard image, drag/drop image, and file-picker input.
- OpenAI-compatible multimodal structured analysis.
- Structured analysis cards for original, reading, translations, vocabulary, grammar, tone, context, and learning points.
- TTS for words and sentences with 0.75x and 1.0x playback.
- SQLite persistence for conversations, messages, attachments, analyses, settings, and word/sentence/grammar notes.
- Saved-state recognition when analyzed content already exists in notes.
- Obsidian export to Words, Sentences, Grammar, and Assets.
- Screenshot association and Markdown embedding.
- Windows-safe path handling, native dialogs, packaging configuration, and Windows CI.
- Tests, documentation, and execution evidence.

## Non-goals

Everything under PRD section 23 remains excluded, including login, sync, mobile, browser extension, OCR pipeline, Anki/SRS, statistics, learning plans, and V0.2/V0.3 encounter/lemma features.

Also excluded:

- Bundled cloud credentials or a hosted proxy/backend.
- Auto-saving AI recommendations.
- Multiple fully implemented AI/TTS vendors in V0.1.
- macOS notarization, Microsoft Store publishing, or signed Windows installers.
- A custom updater.

## Compatibility Requirements

- Windows 10 and Windows 11, x64.
- Japanese and Chinese Unicode text and filenames.
- Windows drive-letter vault paths such as `D:\\Obsidian\\MyVault`.
- No hard-coded `/` separators, POSIX-only shell commands, or macOS-only file APIs in runtime code.
- Runtime data must use Electron's application data directories, not the repository or current working directory.
- Development should remain usable on the current macOS host, but Windows behavior has priority where platform behavior differs.

## Pre-existing Dirty/Untracked Files

The following existed before implementation and must be preserved and ignored by the executor:

- `.DS_Store`
- `docs/.DS_Store`
- `.omx/`

The executor must not delete, add, stage, or edit them.

## Risks and Failure Considerations

- Cloud analysis and TTS cannot succeed without user-provided endpoint/model/key configuration; the UI must surface actionable errors without losing conversation input.
- OpenAI-compatible endpoints vary. The provider boundary must isolate wire-format assumptions.
- LLM structured output can be malformed. Validate it and fail safely; do not render arbitrary model HTML.
- Clipboard/file images and Obsidian paths are untrusted input. Validate size/type and prevent path traversal.
- Electron native SQLite dependencies require correct rebuild/packaging for Windows.
- Windows installer execution cannot be fully proven on the current macOS host. A Windows CI workflow and deterministic commands are required, and any unexecuted Windows-only check must be reported.

## Stop Conditions

Stop and report to the MASTER if implementation requires:

- changing the approved stack or provider contract;
- adding a hosted backend;
- introducing login/cloud sync;
- changing the PRD scope materially;
- storing plaintext API keys on disk;
- writing outside the selected Obsidian vault or Electron data directories;
- modifying the baseline PRD or the pre-existing untracked files;
- credentials, signing certificates, destructive Git operations, commits, rebases, or checkouts.

## Unresolved Questions

None blocking. Provider-specific base URLs, model IDs, API keys, and the user's Vault Path are runtime settings.
