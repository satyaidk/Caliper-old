# Contributing to Caliper

Thank you for helping. This page covers how work moves through the repository,
what a pull request has to pass, and the conventions the code follows.

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | What is deployed. Only `dev` is merged into it. |
| `dev` | Where work lands. Open pull requests against `dev`. |
| `feature/…`, `fix/…` | Your work, branched from `dev`. |

## Setting up

```bash
git clone https://github.com/satyaidk/Caliper.git
cd Caliper
npm install
npm run dev
```

Node 22 or newer is required; `.nvmrc` pins the version CI uses. If you are new
to the codebase, [docs/learning-path.md](docs/learning-path.md) walks through it
in reading order.

## Before you open a pull request

Run the same checks CI runs:

```bash
npm run typecheck
npm test
npm run contrast
npm run build
```

If you changed a loader, `vercel.json` or the service worker, also run the
end-to-end format sweep described in [`e2e/README.md`](e2e/README.md). It is the
only check that sees production-only failures such as a Content-Security-Policy
that blocks a geometry kernel.

## What a good pull request looks like

- **One change.** A bug fix and a refactor are two pull requests.
- **Tests for maths.** Anything that produces a number a person will read — a
  measurement, a volume, a fit check — gets a unit test against a shape whose
  answer can be worked out by hand.
- **Screenshots for interface changes,** in both the dark and the light theme.
- **A changelog line** under an `Unreleased` heading in `CHANGELOG.md`.

The pull request template lists these as a checklist.

## Code conventions

- **The split is load-bearing.** `src/viewer/` never imports React and
  `src/components/` never imports three.js. They meet in the store.
- **Pure where possible.** Analysis code takes a `TriangleSource` or plain
  vectors, not a scene, so it can be tested in Node.
- **Comments explain why.** Each module opens with a docstring that says what
  problem it solves and why it is built the way it is. Line comments are for the
  non-obvious, not for restating the code.
- **Colour comes from tokens.** No hex values in components or `app.css` except
  where a colour is fixed in both themes (the top bar's slate, white on green).
  New text colours must pass `npm run contrast`.
- **Copy is plain.** Sentence case, active voice, no exclamation marks. Errors
  say what happened and what to do next.
- **Keys go in one place.** Shortcuts are added to `src/lib/shortcuts.ts`, which
  drives both the key handler and the shortcuts dialog.

Formatting follows the existing code: two-space indentation, single quotes,
trailing commas, lines up to about 110 characters.

## Commit messages

Write the subject as what the change does, in the imperative, under 72
characters: "Fill section cuts with a hatched cap", not "section fix". Use the
body to say why.

## Reporting bugs and asking for features

Use the issue templates. For a bug, the file that triggers it is the most useful
thing you can attach; if it is confidential, say so and describe it instead.
Security problems go through [SECURITY.md](SECURITY.md), not issues.

## Code of conduct

Everyone taking part agrees to the [Code of Conduct](CODE_OF_CONDUCT.md).
