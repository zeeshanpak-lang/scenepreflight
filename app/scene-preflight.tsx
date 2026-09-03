"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  ChevronRight,
  Clapperboard,
  Clock,
  Coins,
  Copy,
  Eye,
  Film,
  LockKeyhole,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  User,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type SceneStatus = "approved" | "review" | "draft";
type Direction = "Left → right" | "Right → left" | "Static";
type CompanionPosition = "Camera-right" | "Camera-left" | "Not present";

type Scene = {
  id: "SC-01" | "SC-02" | "SC-03";
  title: string;
  location: string;
  duration: number;
  identity: string;
  wardrobe: string;
  direction: Direction;
  companion: CompanionPosition;
  expectsCompanion: boolean;
  action: string;
  camera: string;
  audio: string;
  creditCost: number;
  status: SceneStatus;
  imagePosition: "left" | "center" | "right";
};

type EditableSceneFields = Pick<
  Scene,
  "duration" | "wardrobe" | "direction" | "companion" | "action" | "camera" | "audio"
>;

type Proposal = {
  id: string;
  sceneId: Scene["id"];
  changes: Partial<EditableSceneFields>;
  reason: string;
  source: "browser agent" | "local rehearsal";
  createdAt: string;
};

type ActivityEntry = {
  id: string;
  time: string;
  actor: "Human" | "Agent" | "System";
  text: string;
};

type CheckResult = {
  id: string;
  label: string;
  detail: string;
  passed: boolean;
};

type WebMCPTool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    readOnlyHint?: boolean;
    untrustedContentHint?: boolean;
  };
  execute: (input: Record<string, unknown>) => string | Promise<string>;
};

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: WebMCPTool,
        options?: { signal?: AbortSignal },
      ) => Promise<void>;
    };
  }
}

const STORAGE_KEY = "scenepreflight-demo-v1";
const CORRECT_IDENTITY = "Mara · adult explorer";
const CORRECT_WARDROBE = "Cobalt winter coat · silver scarf";
const CORRECT_DIRECTION: Direction = "Left → right";
const CORRECT_COMPANION: CompanionPosition = "Camera-right";
const MAX_DURATION = 10;

const CANON = [
  {
    id: "identity",
    label: "Lead identity",
    value: CORRECT_IDENTITY,
    note: "Same face and braid in every shot",
  },
  {
    id: "wardrobe",
    label: "Wardrobe",
    value: CORRECT_WARDROBE,
    note: "No color or accessory drift",
  },
  {
    id: "direction",
    label: "Travel direction",
    value: CORRECT_DIRECTION,
    note: "Preserve screen geography",
  },
  {
    id: "companion",
    label: "Fox blocking",
    value: CORRECT_COMPANION,
    note: "When present, keep camera-right",
  },
  {
    id: "duration",
    label: "Clip ceiling",
    value: `${MAX_DURATION} seconds`,
    note: "One generation credit per shot",
  },
] as const;

const INITIAL_SCENES: Scene[] = [
  {
    id: "SC-01",
    title: "First Footprint",
    location: "Snowbound conservatory",
    duration: 8,
    identity: CORRECT_IDENTITY,
    wardrobe: CORRECT_WARDROBE,
    direction: CORRECT_DIRECTION,
    companion: "Not present",
    expectsCompanion: false,
    action: "Mara enters the frozen glasshouse and notices a fresh footprint.",
    camera: "Slow 35 mm push-in, waist height",
    audio: "Glass creak, distant wind, no dialogue",
    creditCost: 1,
    status: "approved",
    imagePosition: "left",
  },
  {
    id: "SC-02",
    title: "The Hidden Door",
    location: "Stone service passage",
    duration: 10,
    identity: CORRECT_IDENTITY,
    wardrobe: CORRECT_WARDROBE,
    direction: CORRECT_DIRECTION,
    companion: "Not present",
    expectsCompanion: false,
    action: "She crosses through the revealed passage without reversing direction.",
    camera: "Locked profile frame, subtle handheld texture",
    audio: "Boots on snow, low score begins",
    creditCost: 1,
    status: "approved",
    imagePosition: "center",
  },
  {
    id: "SC-03",
    title: "The Ice Chamber",
    location: "Blue glacial vault",
    duration: 12,
    identity: CORRECT_IDENTITY,
    wardrobe: "Ivory parka · no scarf",
    direction: "Right → left",
    companion: "Camera-left",
    expectsCompanion: true,
    action: "Mara follows the white fox into the chamber and stops at the frozen lake.",
    camera: "Lateral 35 mm track into a quiet two-shot",
    audio: "Ice resonance under whispered narration",
    creditCost: 1,
    status: "review",
    imagePosition: "right",
  },
];

const INITIAL_ACTIVITY: ActivityEntry[] = [
  {
    id: "activity-1",
    time: "09:12",
    actor: "Human",
    text: "Locked five production canon rules.",
  },
  {
    id: "activity-2",
    time: "09:14",
    actor: "System",
    text: "Found four continuity blockers in SC-03.",
  },
];

const PROMPT =
  "Inspect ScenePreflight and SC-03. Keep every canon lock, reserve one retry, and stage the smallest revision that clears all blockers. Do not mark it generation-ready.";

const json = (value: unknown) => JSON.stringify(value, null, 2);

function nowTime() {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function checksFor(scene: Scene): CheckResult[] {
  return [
    {
      id: "identity",
      label: "Lead identity",
      detail: scene.identity,
      passed: scene.identity === CORRECT_IDENTITY,
    },
    {
      id: "wardrobe",
      label: "Wardrobe continuity",
      detail: scene.wardrobe,
      passed: scene.wardrobe === CORRECT_WARDROBE,
    },
    {
      id: "direction",
      label: "Screen direction",
      detail: scene.direction,
      passed: scene.direction === CORRECT_DIRECTION,
    },
    {
      id: "companion",
      label: "Companion blocking",
      detail: scene.expectsCompanion ? scene.companion : "Not required in this shot",
      passed: !scene.expectsCompanion || scene.companion === CORRECT_COMPANION,
    },
    {
      id: "duration",
      label: "Generation window",
      detail: `${scene.duration}s of ${MAX_DURATION}s maximum`,
      passed: scene.duration <= MAX_DURATION,
    },
    {
      id: "audio",
      label: "Audio intent",
      detail: scene.audio || "No audio direction",
      passed: scene.audio.trim().length > 8,
    },
    {
      id: "budget",
      label: "Credit exposure",
      detail: `${scene.creditCost} credit planned`,
      passed: scene.creditCost === 1,
    },
  ];
}

function scoreFor(checks: CheckResult[]) {
  return Math.round(
    (checks.filter((check) => check.passed).length / checks.length) * 100,
  );
}

function normalizeSceneId(value: unknown): Scene["id"] | null {
  return value === "SC-01" || value === "SC-02" || value === "SC-03"
    ? value
    : null;
}

const FIELD_LABELS: Record<keyof EditableSceneFields, string> = {
  duration: "Duration",
  wardrobe: "Wardrobe",
  direction: "Screen direction",
  companion: "Fox blocking",
  action: "Action",
  camera: "Camera",
  audio: "Audio",
};

export default function ScenePreflight() {
  const [scenes, setScenes] = useState<Scene[]>(INITIAL_SCENES);
  const [selectedId, setSelectedId] = useState<Scene["id"]>("SC-03");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [activity, setActivity] = useState<ActivityEntry[]>(INITIAL_ACTIVITY);
  const [budget, setBudget] = useState({ total: 5, spent: 2, reserved: 1 });
  const [mcpState, setMcpState] = useState<"checking" | "ready" | "rehearsal">(
    "checking",
  );
  const [copied, setCopied] = useState(false);
  const [runPulse, setRunPulse] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const liveRef = useRef({ scenes, selectedId, proposal, activity, budget });

  useEffect(() => {
    liveRef.current = { scenes, selectedId, proposal, activity, budget };
  }, [activity, budget, proposal, scenes, selectedId]);

  const selected =
    scenes.find((scene) => scene.id === selectedId) ?? scenes[scenes.length - 1];
  const checks = useMemo(() => checksFor(selected), [selected]);
  const blockers = checks.filter((check) => !check.passed);
  const score = scoreFor(checks);
  const availableCredits = budget.total - budget.spent - budget.reserved;

  const appendActivity = useCallback(
    (actor: ActivityEntry["actor"], text: string) => {
      setActivity((current) => [
        {
          id: makeId("activity"),
          time: nowTime(),
          actor,
          text,
        },
        ...current,
      ].slice(0, 8));
    },
    [],
  );

  const stageProposal = useCallback(
    (
      sceneId: Scene["id"],
      changes: Partial<EditableSceneFields>,
      reason: string,
      source: Proposal["source"],
    ) => {
      const next: Proposal = {
        id: makeId("proposal"),
        sceneId,
        changes,
        reason,
        source,
        createdAt: nowTime(),
      };
      setSelectedId(sceneId);
      setProposal(next);
      appendActivity(
        source === "browser agent" ? "Agent" : "System",
        `Staged ${Object.keys(changes).length} changes for ${sceneId}; human approval required.`,
      );
      return next;
    },
    [appendActivity],
  );

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as {
            scenes?: Scene[];
            selectedId?: Scene["id"];
            activity?: ActivityEntry[];
            budget?: { total: number; spent: number; reserved: number };
          };
          if (saved.scenes?.length === 3) setScenes(saved.scenes);
          if (normalizeSceneId(saved.selectedId)) setSelectedId(saved.selectedId!);
          if (saved.activity?.length) setActivity(saved.activity);
          if (saved.budget) setBudget(saved.budget);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ scenes, selectedId, activity, budget }),
    );
  }, [activity, budget, hydrated, scenes, selectedId]);

  useEffect(() => {
    const modelContext = document.modelContext;
    if (!modelContext) {
      queueMicrotask(() => setMcpState("rehearsal"));
      return;
    }

    const controller = new AbortController();
    let active = true;

    const tools: WebMCPTool[] = [
      {
        name: "scene_preflight_get_production_state",
        description:
          "Read the production canon, credit budget, scene statuses, current selection, and pending human-review proposal in ScenePreflight.",
        inputSchema: {
          type: "object",
          properties: {
            include_scene_details: {
              type: "boolean",
              description: "Include full shot specifications for every scene.",
            },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ include_scene_details }) => {
          const state = liveRef.current;
          return json({
            project: "The Glass Garden",
            canon: CANON,
            budget: {
              ...state.budget,
              available:
                state.budget.total - state.budget.spent - state.budget.reserved,
            },
            selected_scene_id: state.selectedId,
            scenes: state.scenes.map((scene) =>
              include_scene_details
                ? scene
                : {
                    id: scene.id,
                    title: scene.title,
                    status: scene.status,
                    blocker_count: checksFor(scene).filter((check) => !check.passed)
                      .length,
                  },
            ),
            pending_human_review: state.proposal,
            authority_boundary:
              "Agents may inspect and stage changes. Only a human can apply a revision or mark a shot generation-ready.",
          });
        },
      },
      {
        name: "scene_preflight_inspect_scene",
        description:
          "Inspect one scene's shot specification, applicable canon rules, deterministic preflight checks, and score.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: {
              type: "string",
              enum: ["SC-01", "SC-02", "SC-03"],
              description: "The scene identifier to inspect.",
            },
          },
          required: ["scene_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ scene_id }) => {
          const id = normalizeSceneId(scene_id);
          const scene = liveRef.current.scenes.find((item) => item.id === id);
          if (!scene) return json({ error: "Unknown scene_id" });
          const sceneChecks = checksFor(scene);
          return json({
            scene,
            checks: sceneChecks,
            score: scoreFor(sceneChecks),
            blockers: sceneChecks.filter((check) => !check.passed),
          });
        },
      },
      {
        name: "scene_preflight_focus_scene",
        description:
          "Focus a scene in the visible ScenePreflight interface so the human and agent share the same context.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: {
              type: "string",
              enum: ["SC-01", "SC-02", "SC-03"],
            },
          },
          required: ["scene_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: ({ scene_id }) => {
          const id = normalizeSceneId(scene_id);
          if (!id) return json({ error: "Unknown scene_id" });
          setSelectedId(id);
          return json({ status: "FOCUSED", scene_id: id, reversible: true });
        },
      },
      {
        name: "scene_preflight_run_preflight",
        description:
          "Run deterministic continuity, timing, audio, and credit checks for one scene without changing production state.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: {
              type: "string",
              enum: ["SC-01", "SC-02", "SC-03"],
            },
          },
          required: ["scene_id"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ scene_id }) => {
          const id = normalizeSceneId(scene_id);
          const scene = liveRef.current.scenes.find((item) => item.id === id);
          if (!scene) return json({ error: "Unknown scene_id" });
          const results = checksFor(scene);
          return json({
            scene_id: scene.id,
            score: scoreFor(results),
            blocker_count: results.filter((check) => !check.passed).length,
            checks: results,
          });
        },
      },
      {
        name: "scene_preflight_propose_shot_revision",
        description:
          "Stage a minimal shot revision for explicit human review. This never edits locked canon, applies changes, spends credits, or approves generation.",
        inputSchema: {
          type: "object",
          properties: {
            scene_id: {
              type: "string",
              enum: ["SC-01", "SC-02", "SC-03"],
            },
            duration_seconds: { type: "number", minimum: 1, maximum: 10 },
            wardrobe: { type: "string", maxLength: 120 },
            screen_direction: {
              type: "string",
              enum: ["Left → right", "Right → left", "Static"],
            },
            companion_position: {
              type: "string",
              enum: ["Camera-right", "Camera-left", "Not present"],
            },
            action: { type: "string", maxLength: 280 },
            camera: { type: "string", maxLength: 180 },
            audio: { type: "string", maxLength: 180 },
            reason: { type: "string", minLength: 8, maxLength: 300 },
          },
          required: ["scene_id", "reason"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => {
          const id = normalizeSceneId(input.scene_id);
          const scene = liveRef.current.scenes.find((item) => item.id === id);
          if (!id || !scene) return json({ error: "Unknown scene_id" });

          const changes: Partial<EditableSceneFields> = {};
          if (typeof input.duration_seconds === "number")
            changes.duration = input.duration_seconds;
          if (typeof input.wardrobe === "string") changes.wardrobe = input.wardrobe;
          if (
            input.screen_direction === "Left → right" ||
            input.screen_direction === "Right → left" ||
            input.screen_direction === "Static"
          )
            changes.direction = input.screen_direction;
          if (
            input.companion_position === "Camera-right" ||
            input.companion_position === "Camera-left" ||
            input.companion_position === "Not present"
          )
            changes.companion = input.companion_position;
          if (typeof input.action === "string") changes.action = input.action;
          if (typeof input.camera === "string") changes.camera = input.camera;
          if (typeof input.audio === "string") changes.audio = input.audio;
          if (Object.keys(changes).length === 0)
            return json({ error: "At least one shot change is required." });

          const staged = stageProposal(
            id,
            changes,
            typeof input.reason === "string"
              ? input.reason
              : "Agent-proposed continuity repair",
            "browser agent",
          );
          const candidate = { ...scene, ...changes };
          const predicted = checksFor(candidate);
          return json({
            status: "STAGED_FOR_HUMAN_REVIEW",
            proposal_id: staged.id,
            scene_id: id,
            predicted_score: scoreFor(predicted),
            remaining_blockers: predicted.filter((check) => !check.passed),
            applied: false,
            approval_required: true,
          });
        },
      },
      {
        name: "scene_preflight_plan_credits",
        description:
          "Calculate whether a requested set of one-credit scene generations plus retry reserve fits the remaining budget. Does not spend or reserve credits.",
        inputSchema: {
          type: "object",
          properties: {
            scene_ids: {
              type: "array",
              items: { type: "string", enum: ["SC-01", "SC-02", "SC-03"] },
              minItems: 1,
              uniqueItems: true,
            },
            reserve_retries: { type: "integer", minimum: 0, maximum: 3 },
          },
          required: ["scene_ids", "reserve_retries"],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ scene_ids, reserve_retries }) => {
          const requestedScenes = Array.isArray(scene_ids)
            ? scene_ids.filter((item) => normalizeSceneId(item))
            : [];
          const retries =
            typeof reserve_retries === "number" ? reserve_retries : 0;
          const remaining =
            liveRef.current.budget.total - liveRef.current.budget.spent;
          const required = requestedScenes.length + retries;
          return json({
            requested_scene_ids: requestedScenes,
            generation_credits: requestedScenes.length,
            retry_reserve: retries,
            credits_required: required,
            credits_remaining_before_plan: remaining,
            feasible: required <= remaining,
            recommendation:
              required <= remaining
                ? "Plan fits. Ask the human to confirm before generation."
                : `Reduce the plan by ${required - remaining} credit(s).`,
          });
        },
      },
      {
        name: "scene_preflight_get_activity_receipt",
        description:
          "Read the latest human, agent, and deterministic-system actions for an auditable handoff receipt.",
        inputSchema: {
          type: "object",
          properties: {
            limit: { type: "integer", minimum: 1, maximum: 8, default: 5 },
          },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: ({ limit }) =>
          json({
            project: "The Glass Garden",
            entries: liveRef.current.activity.slice(
              0,
              typeof limit === "number" ? limit : 5,
            ),
          }),
      },
    ];

    Promise.all(
      tools.map((tool) =>
        modelContext.registerTool(tool, { signal: controller.signal }),
      ),
    )
      .then(() => {
        if (active) setMcpState("ready");
      })
      .catch(() => {
        if (active) setMcpState("rehearsal");
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [stageProposal]);

  function updateScene(changes: Partial<EditableSceneFields>) {
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedId ? { ...scene, ...changes, status: "review" } : scene,
      ),
    );
    if (proposal?.sceneId === selectedId) setProposal(null);
  }

  function applyProposal() {
    if (!proposal) return;
    setScenes((current) =>
      current.map((scene) =>
        scene.id === proposal.sceneId
          ? { ...scene, ...proposal.changes, status: "review" }
          : scene,
      ),
    );
    appendActivity(
      "Human",
      `Applied staged revision to ${proposal.sceneId}. No credit spent.`,
    );
    setProposal(null);
  }

  function dismissProposal() {
    if (!proposal) return;
    appendActivity("Human", `Dismissed staged revision for ${proposal.sceneId}.`);
    setProposal(null);
  }

  function rehearseRepair() {
    stageProposal(
      selected.id,
      {
        duration: Math.min(selected.duration, MAX_DURATION),
        wardrobe: CORRECT_WARDROBE,
        direction: CORRECT_DIRECTION,
        companion: selected.expectsCompanion
          ? CORRECT_COMPANION
          : selected.companion,
      },
      "Restore locked wardrobe, geography, fox blocking, and the ten-second generation ceiling.",
      "local rehearsal",
    );
  }

  function runPreflight() {
    setRunPulse(true);
    appendActivity(
      "System",
      blockers.length
        ? `Preflight found ${blockers.length} blocker${blockers.length === 1 ? "" : "s"} in ${selected.id}.`
        : `${selected.id} cleared every deterministic preflight check.`,
    );
    window.setTimeout(() => setRunPulse(false), 600);
  }

  function markReady() {
    if (blockers.length) return;
    setScenes((current) =>
      current.map((scene) =>
        scene.id === selectedId ? { ...scene, status: "approved" } : scene,
      ),
    );
    appendActivity(
      "Human",
      `Marked ${selected.id} generation-ready. Credit remains unspent until render.`,
    );
  }

  function toggleRetryReserve() {
    setBudget((current) => ({
      ...current,
      reserved: current.reserved === 1 ? 0 : 1,
    }));
    appendActivity(
      "Human",
      budget.reserved === 1
        ? "Released the retry reserve."
        : "Reserved one credit for a failed generation.",
    );
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(PROMPT);
    } finally {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  }

  function resetDemo() {
    setScenes(INITIAL_SCENES);
    setSelectedId("SC-03");
    setProposal(null);
    setActivity(INITIAL_ACTIVITY);
    setBudget({ total: 5, spent: 2, reserved: 1 });
    window.localStorage.removeItem(STORAGE_KEY);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark" aria-hidden="true">
            <Clapperboard size={20} strokeWidth={1.8} />
          </div>
          <div>
            <div className="brand-name">ScenePreflight</div>
            <div className="project-name">The Glass Garden · previs v0.3</div>
          </div>
        </div>

        <div className="topbar-actions">
          <div
            className={`mcp-status ${mcpState}`}
            title={
              mcpState === "ready"
                ? "Seven WebMCP tools registered"
                : "Use the local rehearsal in browsers without WebMCP"
            }
          >
            <span className="status-dot" />
            {mcpState === "ready"
              ? "WebMCP · 7 tools live"
              : mcpState === "checking"
                ? "Checking WebMCP"
                : "Rehearsal mode"}
          </div>
          <button className="icon-button" onClick={resetDemo} title="Reset demo">
            <RotateCcw size={17} />
            <span>Reset</span>
          </button>
        </div>
      </header>

      <section className="agent-strip" aria-label="Agent rehearsal prompt">
        <div className="agent-strip-icon">
          <Sparkles size={17} />
        </div>
        <div className="agent-strip-copy">
          <span className="eyebrow">Agent brief</span>
          <p>{PROMPT}</p>
        </div>
        <button className="copy-button" onClick={copyPrompt}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy prompt"}
        </button>
      </section>

      <div className="workspace">
        <aside className="panel canon-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Production truth</span>
              <h2>Canon locks</h2>
            </div>
            <span className="count-pill">5 / 5</span>
          </div>

          <div className="canon-list">
            {CANON.map((item) => (
              <article className="canon-item" key={item.id}>
                <div className="canon-icon">
                  <LockKeyhole size={14} />
                </div>
                <div>
                  <h3>{item.label}</h3>
                  <p>{item.value}</p>
                  <span>{item.note}</span>
                </div>
              </article>
            ))}
          </div>

          <section className="credit-card">
            <div className="credit-title-row">
              <div>
                <span className="eyebrow">Credit exposure</span>
                <strong>{availableCredits} available</strong>
              </div>
              <Coins size={19} />
            </div>
            <div className="credit-meter" aria-label="Five generation credits">
              {Array.from({ length: budget.total }).map((_, index) => {
                const state =
                  index < budget.spent
                    ? "spent"
                    : index < budget.spent + budget.reserved
                      ? "reserved"
                      : "available";
                return <span className={state} key={index} />;
              })}
            </div>
            <div className="credit-legend">
              <span><i className="spent" />{budget.spent} spent</span>
              <span><i className="reserved" />{budget.reserved} retry</span>
              <span><i className="available" />{availableCredits} free</span>
            </div>
            <button className="text-button" onClick={toggleRetryReserve}>
              {budget.reserved ? "Release retry reserve" : "Reserve one retry"}
              <ChevronRight size={15} />
            </button>
          </section>

          <section className="activity-card">
            <div className="mini-heading">
              <span><Activity size={15} /> Activity receipt</span>
              <span className="live-label">Live</span>
            </div>
            <div className="activity-list">
              {activity.slice(0, 3).map((entry) => (
                <div className="activity-row" key={entry.id}>
                  <div className={`actor-icon ${entry.actor.toLowerCase()}`}>
                    {entry.actor === "Human" ? (
                      <User size={13} />
                    ) : entry.actor === "Agent" ? (
                      <Bot size={13} />
                    ) : (
                      <Activity size={13} />
                    )}
                  </div>
                  <div>
                    <span>{entry.actor} · {entry.time}</span>
                    <p>{entry.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>

        <section className="board-column">
          <div className="board-heading">
            <div>
              <span className="eyebrow">Storyboard</span>
              <h1>Three shots. One continuity line.</h1>
            </div>
            <div className="board-meta">
              <span><Film size={14} /> 3 shots</span>
              <span><Clock size={14} /> {scenes.reduce((sum, scene) => sum + scene.duration, 0)} sec</span>
            </div>
          </div>

          <div className="storyboard-grid">
            {scenes.map((scene) => {
              const sceneBlockers = checksFor(scene).filter((check) => !check.passed);
              return (
                <button
                  className={`scene-card ${selectedId === scene.id ? "selected" : ""}`}
                  key={scene.id}
                  onClick={() => setSelectedId(scene.id)}
                  aria-pressed={selectedId === scene.id}
                >
                  <div
                    className={`scene-image position-${scene.imagePosition}`}
                    role="img"
                    aria-label={`${scene.title}: ${scene.location}`}
                  >
                    <span className="scene-number">{scene.id}</span>
                    <span
                      className={`scene-state ${sceneBlockers.length ? "warning" : "clear"}`}
                    >
                      {sceneBlockers.length ? (
                        <><AlertTriangle size={12} /> {sceneBlockers.length}</>
                      ) : (
                        <><Check size={12} /> Clear</>
                      )}
                    </span>
                  </div>
                  <div className="scene-card-copy">
                    <div>
                      <h3>{scene.title}</h3>
                      <p>{scene.location}</p>
                    </div>
                    <span>{scene.duration}s</span>
                  </div>
                </button>
              );
            })}
          </div>

          <section className="shot-spec">
            <div className="shot-spec-heading">
              <div>
                <span className="eyebrow">Selected shot · {selected.id}</span>
                <h2>{selected.title}</h2>
              </div>
              <div className={`shot-status ${selected.status}`}>
                {selected.status === "approved" ? <ShieldCheck size={14} /> : <Eye size={14} />}
                {selected.status === "approved" ? "Generation-ready" : "In review"}
              </div>
            </div>

            <div className="spec-grid">
              <label>
                <span>Wardrobe</span>
                <select
                  value={selected.wardrobe}
                  onChange={(event) => updateScene({ wardrobe: event.target.value })}
                >
                  <option>{CORRECT_WARDROBE}</option>
                  <option>Ivory parka · no scarf</option>
                </select>
              </label>
              <label>
                <span>Duration</span>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={selected.duration}
                    onChange={(event) =>
                      updateScene({ duration: Number(event.target.value) || 1 })
                    }
                  />
                  <span>sec</span>
                </div>
              </label>
              <label>
                <span>Screen direction</span>
                <select
                  value={selected.direction}
                  onChange={(event) =>
                    updateScene({ direction: event.target.value as Direction })
                  }
                >
                  <option>Left → right</option>
                  <option>Right → left</option>
                  <option>Static</option>
                </select>
              </label>
              <label>
                <span>Fox blocking</span>
                <select
                  value={selected.companion}
                  disabled={!selected.expectsCompanion}
                  onChange={(event) =>
                    updateScene({
                      companion: event.target.value as CompanionPosition,
                    })
                  }
                >
                  <option>Camera-right</option>
                  <option>Camera-left</option>
                  <option>Not present</option>
                </select>
              </label>
              <label className="wide-field">
                <span>Action</span>
                <textarea
                  rows={2}
                  value={selected.action}
                  onChange={(event) => updateScene({ action: event.target.value })}
                />
              </label>
              <label>
                <span>Camera</span>
                <input
                  value={selected.camera}
                  onChange={(event) => updateScene({ camera: event.target.value })}
                />
              </label>
              <label>
                <span>Audio</span>
                <input
                  value={selected.audio}
                  onChange={(event) => updateScene({ audio: event.target.value })}
                />
              </label>
            </div>
          </section>
        </section>

        <aside className={`panel preflight-panel ${runPulse ? "pulse" : ""}`}>
          <div className="preflight-topline">
            <div>
              <span className="eyebrow">Deterministic preflight</span>
              <h2>{selected.id} integrity</h2>
            </div>
            <div className={`score-ring ${blockers.length ? "warn" : "pass"}`}>
              <strong>{score}</strong>
              <span>/ 100</span>
            </div>
          </div>

          <div className={`verdict ${blockers.length ? "blocked" : "cleared"}`}>
            {blockers.length ? <AlertTriangle size={17} /> : <ShieldCheck size={17} />}
            <div>
              <strong>
                {blockers.length
                  ? `${blockers.length} generation blocker${blockers.length === 1 ? "" : "s"}`
                  : "Safe to generate"}
              </strong>
              <span>
                {blockers.length
                  ? "Repair before spending another credit."
                  : "All locked production rules are preserved."}
              </span>
            </div>
          </div>

          <div className="check-list">
            {checks.map((check) => (
              <div className={`check-row ${check.passed ? "passed" : "failed"}`} key={check.id}>
                <div className="check-symbol">
                  {check.passed ? <Check size={14} /> : <X size={14} />}
                </div>
                <div>
                  <strong>{check.label}</strong>
                  <span>{check.detail}</span>
                </div>
              </div>
            ))}
          </div>

          {proposal ? (
            <section className="proposal-card">
              <div className="proposal-heading">
                <div className="proposal-icon"><Bot size={16} /></div>
                <div>
                  <span className="eyebrow">Staged · {proposal.source}</span>
                  <h3>Revision awaits you</h3>
                </div>
              </div>
              <p className="proposal-reason">{proposal.reason}</p>
              <div className="diff-list">
                {(Object.keys(proposal.changes) as (keyof EditableSceneFields)[]).map(
                  (field) => (
                    <div className="diff-row" key={field}>
                      <span>{FIELD_LABELS[field]}</span>
                      <div>
                        <del>{String(selected[field])}</del>
                        <ArrowRight size={13} />
                        <ins>{String(proposal.changes[field])}</ins>
                      </div>
                    </div>
                  ),
                )}
              </div>
              <div className="proposal-actions">
                <button className="secondary-button" onClick={dismissProposal}>
                  Dismiss
                </button>
                <button className="primary-button" onClick={applyProposal}>
                  <Check size={16} /> Apply revision
                </button>
              </div>
              <span className="human-note"><User size={13} /> Human-only action</span>
            </section>
          ) : (
            <div className="preflight-actions">
              <button className="secondary-button" onClick={runPreflight}>
                <ShieldCheck size={16} /> Run preflight
              </button>
              {blockers.length ? (
                <button className="primary-button" onClick={rehearseRepair}>
                  <Sparkles size={16} /> Stage agent repair
                </button>
              ) : (
                <button
                  className="primary-button"
                  onClick={markReady}
                  disabled={selected.status === "approved"}
                >
                  <Check size={16} />
                  {selected.status === "approved" ? "Ready" : "Mark generation-ready"}
                </button>
              )}
            </div>
          )}

          <div className="authority-note">
            <LockKeyhole size={14} />
            <p><strong>Authority boundary:</strong> agents can inspect and stage. Only you can apply or approve.</p>
          </div>
        </aside>
      </div>
    </main>
  );
}
