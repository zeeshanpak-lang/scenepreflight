# ScenePreflight

**Protect continuity before you spend the generation credit.**

ScenePreflight is an agent-native preproduction board for AI filmmakers. It exposes a production's canon, shot specifications, deterministic continuity checks, and credit constraints through native WebMCP tools. A browser agent can inspect the project and stage a minimal repair, while the creator keeps the final authority to apply changes or approve a shot for generation.

**Live demo:** https://scene-preflight.zeshu090.chatgpt.site

The demo project, *The Glass Garden*, intentionally starts with four problems in Scene 03: the wrong coat, reversed screen direction, misplaced fox, and an overlong clip. The intended demo path is:

1. Inspect the production and Scene 03.
2. Run the deterministic preflight.
3. Stage the smallest continuity-safe revision.
4. Let the human review the exact diff.
5. Apply the revision and mark the shot generation-ready.

No video model or paid API is called. The product protects scarce generation credits *before* a render is attempted.

## Why WebMCP matters

DOM scraping gives an agent pixels and labels. ScenePreflight gives it a typed production model with explicit capabilities and authority boundaries. The page registers seven tools through **document.modelContext.registerTool()**:

| Tool | Effect |
| --- | --- |
| scene_preflight_get_production_state | Reads canon, budget, scene summaries, and pending review |
| scene_preflight_inspect_scene | Reads one complete shot specification and its checks |
| scene_preflight_focus_scene | Focuses the shared UI on a scene; reversible |
| scene_preflight_run_preflight | Runs deterministic continuity and budget checks |
| scene_preflight_propose_shot_revision | Stages a typed revision for human review |
| scene_preflight_plan_credits | Simulates generations plus retry reserve |
| scene_preflight_get_activity_receipt | Reads the latest human/agent/system handoff log |

The agent deliberately has **no tool** to apply a revision, spend a credit, or mark a scene generation-ready. Those remain human-only actions in the interface.

## Local setup

Requirements: Node.js 22.13 or newer.

~~~bash
npm ci
npm run dev
~~~

Open the printed local URL. The interface works in ordinary browsers through its clearly labeled rehearsal mode. To exercise the native tool surface, use a WebMCP-capable browser or the ChatGPT in-app browser. In Chrome's developer preview, enable **chrome://flags/#enable-webmcp-testing**.

Suggested agent prompt:

> Inspect ScenePreflight and SC-03. Keep every canon lock, reserve one retry, and stage the smallest revision that clears all blockers. Do not mark it generation-ready.

## Stack

- React 19 and TypeScript
- Next.js-compatible App Router on Vinext/Vite
- Native declarative WebMCP browser API
- Deterministic client-side validation
- LocalStorage for reversible demo state
- Lucide icons and original AI-assisted storyboard imagery

## Design principles

- **Structured context:** canon and shot state are machine-readable rather than scraped.
- **Least authority:** an agent proposes; a human commits.
- **Deterministic safety:** continuity checks do not depend on model judgment.
- **Budget awareness:** every generation and retry has visible credit exposure.
- **Auditable handoff:** actions are recorded with their actor and time.

## License

MIT — see [LICENSE](LICENSE).
