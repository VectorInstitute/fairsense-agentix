# Architecture

This page documents the system architecture of FairSense-AgentiX, including the agentic workflow, component design, and technology stack.

---

## System Overview

FairSense-AgentiX is built on an **agentic architecture** that uses a ReAct (Reasoning + Acting) pattern to intelligently analyze content for bias and AI risks. Unlike traditional ML pipelines, the orchestrator **routes** each request to one workflow, **evaluates** output quality, and optionally **refines** before finalizing.

The overview below is split into two views so the layout stays readable: **request lifecycle** (orchestrator) and **workflow dispatch** (subgraphs + tools).

### Request lifecycle

<div class="fs-arch-diagram" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 28, "rankSpacing": 32}} }%%
flowchart TB
    Client(["Client · API · CLI · GUI"])
    API["FairSense API · analyze_text · analyze_image · assess_risk"]

    Client --> API
    API --> Router["Router · workflow selection"]
    Router --> Preflight["Preflight evaluation"]
    Preflight --> Execute["Execute workflow"]
    Execute --> Evaluate["Post-hoc evaluation"]
    Evaluate --> Decide{{"Decide action"}}
    Decide -->|Accept / fail| Finalize["Finalize result"]
    Decide -->|Refine| Refine["Apply refinement · loop to router"]

    classDef entry fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111
    classDef step fill:#e8f7fb,stroke:#48c0d9,stroke-width:2px,color:#111
    classDef gate fill:#fff9c4,stroke:#f9a825,stroke-width:2px,color:#111

    class Client,API entry
    class Router,Preflight,Execute,Evaluate,Refine,Finalize step
    class Decide gate
```

</div>

**Finalize** returns structured results to the caller via the FairSense API. **Refine** updates the plan and re-enters **Router** (same loop as in [State flow](#state-flow) below).

During **Execute**, the orchestrator runs exactly **one** LangGraph subgraph (see next diagram). Telemetry from every node can stream to the React UI over WebSocket.

### Workflow dispatch & tools

`Execute workflow` calls the router-chosen subgraph. Tools are injected from the registry (swap via environment variables—no graph rewrite).

<div class="fs-workflow-grid" markdown>

<div class="grid cards" markdown>

-   :material-text-box-search:{ .vector-icon } __Bias text__

    ---

    `bias_text` · LLM → summarize → highlight

-   :material-image-search:{ .vector-icon } __Bias image (traditional)__

    ---

    `bias_image` · OCR + caption → LLM → highlight

-   :material-eye:{ .vector-icon } __Bias image VLM__

    ---

    `bias_image_vlm` · multimodal LLM → highlight

-   :material-shield-search:{ .vector-icon } __Risk assessment__

    ---

    `risk` · embed → FAISS → RMF actions

</div>

</div>

| Workflow | Tool registry (typical) |
| --- | --- |
| **Bias text** | LLM (OpenAI, Anthropic, or compatible) |
| **Bias image** | OCR (Tesseract / PaddleOCR), caption (BLIP / BLIP-2), LLM |
| **Bias image VLM** | Vision LLM (GPT-4V, Claude Vision, …) |
| **Risk assessment** | Embedder (`sentence-transformers`), FAISS indices (risks + NIST RMF) |

JOSS Figure 1 ([orchestrator topology](https://github.com/VectorInstitute/fairsense-agentix/blob/main/paper/orchestrator_graph_topology_fairsense.png)) shows the same supergraph at paper scale.

### Key Design Principles

1. **Agentic Decision-Making** - The orchestrator autonomously selects workflows, evaluates quality, and refines outputs
2. **Tool Abstraction** - Swappable tool implementations (Tesseract ↔ PaddleOCR, GPT-4 ↔ Claude) via dependency injection
3. **Quality-Driven Refinement** - Evaluator-critic pattern enables iterative improvement until quality thresholds are met
4. **Observable by Design** - Full telemetry streaming via WebSocket for real-time visibility into agent reasoning
5. **Configuration Over Code** - Environment variables control all tool selection, model parameters, and refinement behavior

---

## Component Breakdown

### 1. Client Entry Points

**Purpose:** Provide multiple interfaces for accessing FairSense functionality

**Components:**
- **Python API** (`fairsense_agentix.api.FairSense`) - Main programmatic interface
- **REST API** (`fairsense_agentix.service_api.server`) - FastAPI HTTP endpoints
- **CLI** (planned) - Command-line interface
- **React UI** (`ui/`) - Web-based graphical interface

**Responsibilities:**
- Accept user input (text, images, deployment scenarios)
- Normalize input format
- Invoke orchestrator graph
- Return structured results

---

### 2. Orchestrator Supergraph

**Purpose:** Coordinate the entire analysis workflow using an agentic ReAct loop

**Location:** `fairsense_agentix/graphs/orchestrator_graph.py`

**Architecture:** LangGraph state machine with 7 nodes and conditional edges

#### Nodes

| Node | Purpose | Output |
|------|---------|--------|
| `request_plan` | Calls router to select workflow and configure parameters | `SelectionPlan` |
| `preflight_eval` | Pre-flight validation (future: check resources, API keys) | `EvaluationResult` |
| `execute_workflow` | Delegates to appropriate subgraph (bias_text, risk, etc.) | `workflow_result` dict |
| `posthoc_eval` | Quality assessment via evaluator service | `EvaluationResult` |
| `decide_action` | Determine next action (accept, refine, fail) | `decision` string |
| `apply_refinement` | Update plan with evaluator feedback | Updated `SelectionPlan` |
| `finalize` | Package final result for client | `final_result` dict |

#### State flow

LangGraph node IDs match `fairsense_agentix/graphs/orchestrator/build.py`. Conditional edges use `should_execute_workflow` (preflight) and `route_after_decision` (post-hoc).

<div class="fs-arch-diagram" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 28, "rankSpacing": 32}} }%%
flowchart TB
    START([START]) --> request_plan["request_plan"]
    request_plan --> preflight_eval["preflight_eval"]
    preflight_eval --> execute_workflow["execute_workflow"]
    execute_workflow --> posthoc_eval["posthoc_eval"]
    posthoc_eval --> decide_action{{"decide_action"}}
    decide_action --> finalize["finalize"]
    decide_action --> apply_refinement["apply_refinement · ↻ request_plan"]
    finalize --> END([END])

    classDef step fill:#e8f7fb,stroke:#48c0d9,stroke-width:2px,color:#111
    classDef gate fill:#fff9c4,stroke:#f9a825,stroke-width:2px,color:#111
    classDef term fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111

    class request_plan,preflight_eval,execute_workflow,posthoc_eval,apply_refinement,finalize step
    class decide_action gate
    class START,END term
```

</div>

**Branches not drawn** (they widen the canvas): failed preflight can jump to **finalize**; **apply_refinement** loops to **request_plan** (iteration cap from orchestrator settings).

**Key Features:**
- **ReAct Pattern:** Router reasons about input → Executor acts → Evaluator observes → Decision reflects
- **Refinement Loop:** Iterative quality improvement (disabled by default in Phase 2-6, enabled in Phase 7+)
- **Telemetry Integration:** Every node emits telemetry events for observability
- **Error Handling:** Graceful degradation with error accumulation in state

---

### 3. Router Service

**Purpose:** Analyze input and create an execution plan

**Location:** `fairsense_agentix/services/router.py`

**Responsibilities:**
- Determine which workflow to run (`bias_text`, `bias_image`, `bias_image_vlm`, `risk`)
- Select tool implementations (LLM model, OCR method, VLM vs traditional)
- Configure workflow parameters (temperature, top_k, summarization rules)
- Provide confidence score and reasoning for decision

**Output:** `SelectionPlan` with:
- `workflow_id` - Which subgraph to execute
- `reasoning` - Human-readable explanation
- `confidence` - Routing confidence (0.0-1.0)
- `tool_preferences` - Tool selection hints
- `node_params` - Per-node configuration

**Routing Logic (Phase 2-6):**

| Input Type | Workflow | Conditions |
|------------|----------|------------|
| `text` | `bias_text` | Always (deterministic) |
| `image` | `bias_image_vlm` | If `settings.image_analysis_mode == "vlm"` and provider supports VLM |
| `image` | `bias_image` | If `settings.image_analysis_mode == "traditional"` or no VLM support |
| `csv` | `risk` | Always (deterministic) |

**Future Enhancement (Phase 7+):**
- LLM-based routing for ambiguous inputs
- Content analysis for hybrid workflows
- Fallback cascade (primary → secondary → tertiary)

---

### 4. Workflow Subgraphs

**Purpose:** Execute specialized analysis pipelines

**Location:** `fairsense_agentix/graphs/`

#### 4.1 Bias Text Workflow

**File:** `bias_text_graph.py` · **State:** `BiasTextState`

**Flow** (`bias_text/build.py` — quality checks run in the orchestrator, not here):

<div class="fs-arch-diagram" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 28, "rankSpacing": 32}} }%%
flowchart TB
    START([START]) --> analyze_bias["analyze_bias · LLM structured output"]
    analyze_bias --> summarize["summarize · if needed"]
    summarize --> highlight["highlight · HTML spans"]
    highlight --> END([END])

    classDef step fill:#e8f7fb,stroke:#48c0d9,stroke-width:2px,color:#111
    classDef gate fill:#fff9c4,stroke:#f9a825,stroke-width:2px,color:#111
    classDef term fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111

    class analyze_bias,summarize,highlight step
    class START,END term
```

</div>

**`should_summarize`:** text longer than 500 characters **or** `options.enable_summary=true` (otherwise the graph routes **analyze_bias → highlight** and skips **summarize**).

**Nodes:**

1. **analyze_bias** — LLM bias detection → `BiasAnalysisOutput`
2. **summarize** — optional executive summary (conditional edge)
3. **highlight** — color-coded HTML spans

**Output Fields:**
- `bias_analysis` - Structured Pydantic model with bias instances
- `summary` - Optional executive summary
- `highlighted_html` - HTML with `<span class="bias-{type}">` tags

---

#### 4.2 Bias Image Workflow (Traditional)

**File:** `bias_image_graph.py` · **State:** `BiasImageState`

**Flow** — LangGraph starts **`extract_ocr`** and **`generate_caption`** in parallel, then merges:

<div class="fs-arch-diagram fs-arch-diagram--narrow" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 36, "rankSpacing": 36}} }%%
flowchart TB
    extract_ocr["extract_ocr"] --> merge_text["merge_text"]
    generate_caption["generate_caption"] --> merge_text
    merge_text --> analyze_bias["analyze_bias"]
    analyze_bias --> summarize["summarize"]
    summarize --> highlight["highlight"]
    highlight --> END([END])

    classDef step fill:#fff3e0,stroke:#ffcc80,stroke-width:2px,color:#111
    classDef parallel fill:#e8f7fb,stroke:#48c0d9,stroke-width:2px,color:#111
    classDef term fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111

    class extract_ocr,generate_caption parallel
    class merge_text,analyze_bias,summarize,highlight step
    class END term
```

</div>

**Nodes:**

1. **extract_ocr** — Tesseract or PaddleOCR
2. **generate_caption** — BLIP / BLIP-2
3. **merge_text** — combines OCR + caption for LLM input
4. **analyze_bias** — shared text bias pipeline
5. **summarize** — summary node (always invoked; may no-op on short merged text)
6. **highlight** — HTML spans

**Output Fields:**
- `ocr_text` - Extracted text from image
- `caption_text` - Generated image caption
- `merged_text` - Combined text (OCR + caption)
- `bias_analysis` - Structured bias analysis
- `summary` - Optional summary
- `highlighted_html` - HTML highlighting

**Performance:** Slower than VLM workflow (~10-20s) but works with any LLM provider

---

#### 4.3 Bias Image VLM Workflow

**File:** `bias_image_vlm_graph.py` · **State:** `BiasImageVLMState`

**Flow** — three-node linear graph (no OCR/caption branch):

<div class="fs-arch-diagram" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 28, "rankSpacing": 32}} }%%
flowchart TB
    START([START]) --> visual_analyze["visual_analyze · multimodal LLM + CoT"]
    visual_analyze --> summarize["summarize"]
    summarize --> highlight["highlight"]
    highlight --> END([END])

    classDef step fill:#fff3e0,stroke:#ffcc80,stroke-width:2px,color:#111
    classDef term fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111

    class visual_analyze,summarize,highlight step
    class START,END term
```

</div>

**Nodes:**

1. **visual_analyze** — single VLM call (`GPT-4o` / Claude vision per provider settings)
2. **summarize** — executive summary over VLM output
3. **highlight** — HTML spans (reuses text formatter paths)

**Output Fields:**
- `vlm_analysis` - Structured VLM analysis with:
  - `visual_description` - What the model sees in the image
  - `reasoning_trace` - Chain-of-Thought reasoning steps
  - `bias_analysis` - Bias detection results
- `image_base64` - Base64-encoded image with data URL for UI
- `summary` - Optional summary
- `highlighted_html` - HTML highlighting

**Performance:** Faster than traditional workflow (~5-10s), single API call

**Requirements:** OpenAI or Anthropic provider (VLM support required)

---

#### 4.4 Risk Assessment Workflow

**File:** `risk_graph.py` · **State:** `RiskState`

**Flow** (`risk/build.py`):

<div class="fs-arch-diagram" markdown>

```mermaid
%%{init: {"flowchart": {"useMaxWidth": true, "padding": 12, "nodeSpacing": 28, "rankSpacing": 32}} }%%
flowchart TB
    START([START]) --> embed_scenario["embed_scenario"]
    embed_scenario --> search_risks["search_risks · FAISS"]
    search_risks --> search_rmf_per_risk["search_rmf_per_risk"]
    search_rmf_per_risk --> join_data["join_data"]
    join_data --> format_html["format_html"]
    format_html --> export_csv["export_csv"]
    export_csv --> END([END])

    classDef step fill:#f3e5f5,stroke:#ce93d8,stroke-width:2px,color:#111
    classDef term fill:#fce4ec,stroke:#eb088a,stroke-width:2px,color:#111

    class embed_scenario,search_risks,search_rmf_per_risk,join_data,format_html,export_csv step
    class START,END term
```

</div>

**Nodes:**

1. **embed_scenario** — `sentence-transformers` → 384-dim vector
2. **search_risks** — top-k similarity over the packaged MIT AI Risk Repository index (**1,340** risks, V3)
3. **search_rmf_per_risk** — NIST AI RMF–aligned actions per retrieved risk
4. **join_data** — merge risks + recommendations
5. **format_html** — display table
6. **export_csv** — optional file under `outputs/`

**Output Fields:**
- `embedding` - 384-dimensional vector of scenario
- `risks` - Top-k AI risks with similarity scores
- `rmf_recommendations` - Mitigation strategies per risk
- `html_table` - Formatted HTML table
- `csv_path` - Path to exported CSV file

**Knowledge Base:**
- **Risks:** 1,340 indexed entries from the MIT AI Risk Repository (V3 embeddings)
- **RMF:** companion FAISS index of NIST AI RMF–style mitigation rows joined per risk
- **Storage:** FAISS index files live inside the package at `fairsense_agentix/data/indexes/` in LangChain format:
  ```
  fairsense_agentix/data/indexes/
  ├── risks/index.faiss   # vector index (1,340 risks, 384-dim embeddings)
  ├── risks/index.pkl     # LangChain document store
  ├── risks_meta.json     # human-readable fields (id, risk_name, description, severity, category)
  ├── rmf/index.faiss
  ├── rmf/index.pkl
  └── rmf_meta.json
  ```
  The `FAIRSENSE_FAISS_RISKS_INDEX_PATH` env var uses a virtual `.faiss` path (e.g. `fairsense_agentix/data/indexes/risks.faiss`) — the resolver strips the extension and looks for the `risks/index.faiss` folder structure. If that folder is missing, the system silently falls back to `FakeFAISSIndexTool` which returns hardcoded placeholder results.

---

### 5. Tool Ecosystem

**Purpose:** Provide reusable, swappable implementations of core ML/AI capabilities

**Location:** `fairsense_agentix/tools/`

**Architecture:** Interface-based design with factory pattern via ToolRegistry

#### Tool Registry

**File:** `tools/registry.py`

**Purpose:** Dependency injection container that constructs all tool instances based on configuration

**Pattern:**
```python
@dataclass
class ToolRegistry:
    ocr: OCRTool
    caption: CaptionTool
    llm: LLMTool
    summarizer: SummarizerTool
    embedder: EmbedderTool
    faiss_risks: FAISSIndexTool
    faiss_rmf: FAISSIndexTool
    formatter: FormatterTool
    persistence: PersistenceTool
    vlm: VLMTool

registry = create_tool_registry(settings)
# All tools now available via registry.ocr, registry.llm, etc.
```

**Benefits:**
- **Single Source of Truth:** One place constructs all tools
- **Configuration-Driven:** Settings determine which implementations are used
- **Testability:** Easy to inject fake tools for testing
- **Swappability:** Change implementations without modifying workflow code

---

#### Tool Implementations

| Tool | Interface | Implementations | Purpose |
|------|-----------|-----------------|---------|
| **OCR** | `OCRTool` | Tesseract, PaddleOCR, Fake | Extract text from images |
| **Caption** | `CaptionTool` | BLIP, BLIP-2, Fake | Generate image descriptions |
| **VLM** | `VLMTool` | GPT-4V, Claude Vision, Fake | Multimodal reasoning with CoT |
| **LLM** | `LLMTool` | GPT-4, Claude, any OpenAI-compatible server via `llm_base_url` (Ollama, vLLM), Fake | Text generation and analysis |
| **Embedder** | `EmbedderTool` | sentence-transformers, Fake | Text → vector embeddings |
| **FAISS Index** | `FAISSIndexTool` | FAISS (CPU/GPU) | Semantic search over knowledge bases |
| **Formatter** | `FormatterTool` | HTML/CSV formatter | Output formatting |
| **Persistence** | `PersistenceTool` | File I/O | Save results to disk |
| **Summarizer** | `SummarizerTool` | LLM-based | Generate executive summaries |

---

#### Tool Selection Logic

**Auto-Detection:**
- **OCR:** `settings.ocr_tool = "auto"` → PaddleOCR (GPU) or Tesseract (CPU)
- **Caption:** `settings.caption_model = "auto"` → BLIP-2 (better) or BLIP (fallback)
- **Embedder:** `settings.embedding_provider = "auto"` → sentence-transformers (local, free) or OpenAI (API)

**Manual Override:**
```python
# Force specific implementations
os.environ["FAIRSENSE_OCR_TOOL"] = "tesseract"
os.environ["FAIRSENSE_CAPTION_MODEL"] = "blip2"
os.environ["FAIRSENSE_LLM_PROVIDER"] = "anthropic"
os.environ["FAIRSENSE_LLM_MODEL_NAME"] = "claude-3-5-sonnet-20241022"
```

**Testing Mode:**
```python
# Use fake tools for fast deterministic testing
os.environ["FAIRSENSE_LLM_PROVIDER"] = "fake"
os.environ["FAIRSENSE_OCR_TOOL"] = "fake"
os.environ["FAIRSENSE_CAPTION_MODEL"] = "fake"
```

---

### 6. Evaluator Service

**Purpose:** Post-hoc quality assessment and refinement guidance

**Location:** `fairsense_agentix/services/evaluator.py`

**Components:**

#### 6.1 Bias Evaluator (LLM-Based)

**Purpose:** Critique bias analysis output for completeness and accuracy

**Method:** Single-shot LLM call with structured output

**Evaluation Criteria:**
- **Completeness:** Did the analysis cover all bias categories (gender, age, race, etc.)?
- **Accuracy:** Are bias spans correctly identified and grounded in source text?
- **Actionability:** Are explanations clear and useful?

**Output:**
```python
class BiasEvaluatorOutput(BaseModel):
    score: int  # 0-100
    justification: str  # Why this score
    suggested_changes: list[str]  # Concrete refinement actions
```

**Refinement Triggers:**
- If `score < settings.bias_evaluator_min_score` (default: 75)
- Suggested changes are injected into `options["bias_prompt_feedback"]`
- Orchestrator loops back to `request_plan` with updated guidance

---

#### 6.2 Risk Evaluator (Rule-Based)

**Purpose:** Statistical quality checks for risk assessment output

**Method:** Rule-based validation (no LLM calls)

**Evaluation Criteria:**
- **Diversity:** Are top risks from diverse categories?
- **Coverage:** Sufficient number of RMF recommendations per risk?
- **No Duplicates:** Risk names and descriptions are unique?

**Output:**
```python
class RiskEvaluatorOutput(BaseModel):
    score: int  # 0-100
    justification: str
    issues: list[str]
    suggested_changes: dict[str, Any]  # e.g., {"top_k": 10}
    metadata: dict[str, Any]  # Diagnostics
```

**Refinement Hints:**
- Increase `top_k` if diversity is low
- Adjust `rmf_per_risk` if coverage is insufficient

---

### 7. Telemetry System

**Purpose:** Observable agent reasoning and performance tracking

**Location:** `fairsense_agentix/services/telemetry.py`

**Features:**
- **Event Streaming:** Every orchestrator and workflow node emits a structured `*_start` event; node-level warnings/errors are emitted with the matching `level`
- **WebSocket Integration:** Real-time events pushed to UI via `/v1/stream/{run_id}`
- **Performance Tracking:** Timers for every operation (node execution, tool calls, LLM calls)
- **Context Propagation:** `run_id` tracks execution across all components

**Event Types:**

| Event | Triggered By | Context Fields |
|-------|--------------|----------------|
| `orchestrator_plan_start` | Router node begins | `input_type`, `refinement_count` |
| `orchestrator_preflight_start` | Pre-flight check | `has_plan` |
| `orchestrator_execute_start` | Subgraph dispatch | `workflow_id` |
| `bias_text_analyze_start`, `risk_embed_start`, `bias_image_vlm_analyze_start`, … | Each subgraph node | node-specific (e.g. `text_length`, `risk_count`, `model`) |
| `orchestrator_posthoc_start` | Post-hoc evaluation | `has_result` |
| `orchestrator_decide_start` | Accept / refine decision | `refinement_count`, `refinement_enabled` |
| `orchestrator_refine_start` | Refinement pass triggered | `current_refinement_count` |
| `orchestrator_finalize_start` | Result packaging | `decision`, `refinement_count` |
| `analysis_complete` | Service layer, on success | `message`, `result` (full `AnalyzeResponse`) |
| `analysis_error` | Service layer, on failure | `message`, `error_type` |

The complete per-workflow list is in the [API Reference](api.md#event-types).

**WebSocket Example:**
```python
import websockets

async with websockets.connect(f"ws://localhost:8000/v1/stream/{run_id}") as ws:
    async for message in ws:
        event = json.loads(message)
        print(f"[{event['event']}] {event['context'].get('message', '')}")
```

---

### 8. Service API Layer

**Purpose:** Production-ready HTTP interface for remote analysis

**Location:** `fairsense_agentix/service_api/server.py`

**Technology:** FastAPI with async/await support

**Components:**

#### REST Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/v1/health` | GET | Health check |
| `/v1/analyze` | POST | Synchronous analysis (JSON payload) |
| `/v1/analyze/upload` | POST | File upload analysis (multipart) |
| `/v1/analyze/start` | POST | Async analysis (returns run_id immediately) |
| `/v1/analyze/upload/start` | POST | Async file upload |
| `/v1/batch` | POST | Batch job submission |
| `/v1/batch/{job_id}` | GET | Poll batch status |
| `/v1/shutdown` | POST | Graceful server shutdown |

#### WebSocket Protocol

**Endpoint:** `ws://localhost:8000/v1/stream/{run_id}`

**Purpose:** Real-time telemetry streaming

**Lifecycle:**
1. Client calls `/v1/analyze/start` → receives `run_id`
2. Client connects to `/v1/stream/{run_id}` immediately
3. Backend runs analysis in background, emits events to WebSocket
4. Client closes the WebSocket after `analysis_complete` or `analysis_error` (the server keeps it open)

**Event Format:**
```json
{
  "run_id": "abc123...",
  "timestamp": 1234567890.123,
  "event": "bias_image_ocr_start",
  "level": "info",
  "context": {
    "image_size": 45760
  }
}
```

---

### 9. Frontend UI

**Purpose:** User-friendly web interface for FairSense

**Location:** `ui/`

**Technology:** React 18 + Vite + TypeScript

**Components:**

#### Key Features
1. **Unified Input Panel** - Text field or drag-and-drop image upload
2. **Mode Selector** - Bias (Text), Bias (Image), Risk
3. **Live Timeline** - Real-time agent telemetry visualization
4. **Results Panel** - Structured output with:
   - Bias instances with severity badges
   - Highlighted text with color coding
   - Risk tables with RMF recommendations
5. **Batch Jobs** - Process multiple items with progress tracking
6. **Shutdown Button** - Gracefully stop backend

#### WebSocket Integration
- Connects to `/v1/stream/{run_id}` on analysis start
- Renders timeline events in real-time
- Shows agent reasoning steps (phase transitions, tool calls, LLM calls)
- Displays progress indicators

---

## Data Flow

### Text Bias Analysis Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orchestrator
    participant R as Router
    participant BT as BiasTextGraph
    participant LLM as LLM Tool
    participant E as Evaluator

    C->>O: analyze_text("job posting")
    O->>R: request_plan("text", content)
    R-->>O: SelectionPlan(workflow_id="bias_text")
    O->>O: preflight_eval (validate plan)
    O->>BT: invoke(text, options)
    BT->>LLM: analyze_bias(text, prompt)
    LLM-->>BT: BiasAnalysisOutput
    BT->>BT: highlight (extract spans)
    BT-->>O: {bias_analysis, highlighted_html}
    O->>E: posthoc_eval(result)
    E-->>O: EvaluationResult(passed=true, score=0.85)
    O->>O: decide_action → accept
    O->>O: finalize
    O-->>C: BiasResult
```

### Image Bias Analysis Flow (VLM Mode)

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orchestrator
    participant R as Router
    participant BV as BiasImageVLMGraph
    participant VLM as VLM Tool
    participant E as Evaluator

    C->>O: analyze_image(image_bytes)
    O->>R: request_plan("image", bytes)
    R-->>O: SelectionPlan(workflow_id="bias_image_vlm")
    O->>O: preflight_eval (validate plan)
    O->>BV: invoke(image_bytes, options)
    BV->>VLM: analyze_image(bytes, prompt, BiasVisualAnalysisOutput)
    Note over VLM: Single multimodal LLM call<br/>with CoT reasoning
    VLM-->>BV: BiasVisualAnalysisOutput(visual_description, reasoning_trace, bias_analysis)
    BV->>BV: highlight (extract spans)
    BV-->>O: {vlm_analysis, highlighted_html, image_base64}
    O->>E: posthoc_eval(result)
    E-->>O: EvaluationResult(passed=true)
    O->>O: decide_action → accept
    O->>O: finalize
    O-->>C: BiasResult
```

### Risk Assessment Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant O as Orchestrator
    participant R as Router
    participant RG as RiskGraph
    participant Embed as Embedder
    participant FAISS as FAISS Index
    participant Form as Formatter

    C->>O: assess_risk("deployment scenario")
    O->>R: request_plan("csv", content)
    R-->>O: SelectionPlan(workflow_id="risk")
    O->>O: preflight_eval (validate plan)
    O->>RG: invoke(scenario_text, options)
    RG->>Embed: embed(scenario_text)
    Embed-->>RG: [384-dim vector]
    RG->>FAISS: retrieve_risks(embedding, top_k=5)
    FAISS-->>RG: [(risk1, score1), (risk2, score2), ...]
    RG->>FAISS: retrieve_rmf(risk_ids, per_risk=3)
    FAISS-->>RG: [recommendations]
    RG->>RG: join_results
    RG->>Form: format_output(joined_table)
    Form-->>RG: html_table, csv_path
    RG-->>O: {risks, rmf_recommendations, html_table, csv_path}
    O->>O: decide_action → accept
    O->>O: finalize
    O-->>C: RiskResult
```

---

## Technology Stack

### Core Framework
- **LangGraph** (0.2+) - State graph orchestration for agentic workflows
- **LangChain** (0.3+) - LLM abstractions, tool interfaces, callbacks
- **Pydantic** (2.0+) - Data validation, settings management, structured outputs

### Machine Learning / AI
- **OpenAI API** - GPT-4, GPT-4V (Vision), embeddings
- **Anthropic API** - Claude 3.5 Sonnet, Claude Vision
- **Transformers** (HuggingFace) - BLIP, BLIP-2 for image captioning
- **sentence-transformers** - Local text embeddings (all-MiniLM-L6-v2)
- **FAISS** (Facebook AI Similarity Search) - Vector similarity search
- **Tesseract OCR** - Traditional OCR (CPU-optimized)
- **PaddleOCR** - GPU-accelerated OCR

### Web Framework
- **FastAPI** (0.110+) - Async REST API with WebSocket support
- **uvicorn** - ASGI server
- **Starlette** - WebSocket protocol implementation
- **Pydantic** - Request/response schemas

### Frontend
- **React** (18.2+) - UI framework
- **Vite** (5.0+) - Fast build tool and dev server
- **TypeScript** (5.3+) - Type-safe JavaScript
- **Mantine** (7.0+) - Component library
- **Axios** - HTTP client
- **WebSocket API** - Real-time telemetry

### Development Tools
- **uv** - Fast Python package manager
- **Ruff** - Linter and formatter
- **mypy** - Static type checker
- **pytest** - Testing framework
- **MkDocs + Material** - Documentation generation

---

## Design Patterns

### 1. ReAct (Reasoning + Acting) Pattern

**Purpose:** Enable autonomous agent decision-making

**Implementation:**
- **Reasoning:** Router analyzes input and creates plan
- **Acting:** Orchestrator executes workflow based on plan
- **Observing:** Evaluator assesses output quality
- **Reflecting:** Decision node determines next action (accept/refine/fail)

**Benefits:**
- Dynamic workflow selection based on input characteristics
- Self-improving outputs through refinement loops
- Transparent decision-making via telemetry

---

### 2. Tool Abstraction Pattern

**Purpose:** Swap implementations without changing workflow code

**Implementation:**
```python
# Interface
class OCRTool:
    def extract(self, image_bytes: bytes) -> str: ...

# Implementations
class TesseractOCR(OCRTool): ...
class PaddleOCR(OCRTool): ...
class FakeOCR(OCRTool): ...

# Factory
def _resolve_ocr_tool(settings: Settings) -> OCRTool:
    if settings.ocr_tool == "tesseract":
        return TesseractOCR()
    elif settings.ocr_tool == "paddleocr":
        return PaddleOCR()
    elif settings.ocr_tool == "fake":
        return FakeOCR()
```

**Benefits:**
- Easy testing (inject fake tools)
- Configuration-driven selection
- Clear separation of concerns
- No workflow code changes when adding new tools

---

### 3. Evaluator-Critic Pattern

**Purpose:** Iterative quality improvement through feedback loops

**Implementation:**
1. Workflow produces output
2. Evaluator critiques output (score + suggested changes)
3. If score < threshold:
   - Extract refinement hints from critique
   - Update plan with hints
   - Re-execute workflow with updated guidance
4. Repeat until score >= threshold or max iterations reached

**Benefits:**
- Higher quality outputs (2-3 iterations improve score by 10-20%)
- Self-correcting system (agent learns from mistakes)
- Configurable quality thresholds per use case

---

### 4. Event-Driven Telemetry Pattern

**Purpose:** Observable agent reasoning without coupling

**Implementation:**
```python
# Every operation emits events
with telemetry.timer("node_execution", node_name="analyze_bias"):
    telemetry.log_info("node_start", node=node_name)
    result = analyze_bias(text)
    telemetry.log_info("node_complete", node=node_name, output=result)

# WebSocket listener receives events in real-time
async for event in event_bus.stream(run_id):
    # Display in UI timeline
    render_event(event)
```

**Benefits:**
- Zero coupling between workflows and UI
- Real-time visibility into agent reasoning
- Performance profiling built-in (timers)
- Easy debugging (full execution trace)

---

### 5. Dependency Injection via Registry

**Purpose:** Centralized tool construction and configuration

**Implementation:**
```python
# Single source of truth
registry = create_tool_registry(settings)

# Tools injected into workflows
def create_bias_text_graph() -> CompiledStateGraph:
    registry = get_tool_registry()  # Singleton

    def analyze_bias_node(state):
        result = registry.llm.generate(prompt, output_schema=BiasAnalysisOutput)
        return {"bias_analysis": result}

    # ...
```

**Benefits:**
- Testability (inject mocks)
- Configuration-driven (settings → implementations)
- No global state (explicit dependency passing)
- Single initialization (tools loaded once at startup)

---

## Performance Characteristics

### Startup Time
- **First Import:** 30-60s (model downloads on first run)
- **Subsequent Imports:** 100-200ms (cached models)
- **Eager Loading:** All tools preloaded at import time for instant first use

### Analysis Time

| Workflow | Typical Duration | Bottleneck |
|----------|------------------|------------|
| Bias Text | 2-5s | LLM call (1-3s) |
| Bias Image (Traditional) | 10-20s | OCR (3-5s) + Caption (2-4s) + LLM (3-5s) |
| Bias Image (VLM) | 5-10s | Single VLM call (5-8s) |
| Risk Assessment | 1-3s | FAISS search (50-100ms) + RMF retrieval (200-500ms) |

**With Refinement Enabled:**
- Add 50-100% to above times per iteration
- Typical: 1 refinement iteration (x2 total time)
- Max: 2-3 iterations

### Memory Usage
- **Base Runtime:** ~500MB (Python + LangChain)
- **With Models Loaded:** ~2-3GB (BLIP-2, sentence-transformers, FAISS indices)
- **During Analysis:** +200-500MB (temporary buffers)

### Concurrency
- **FastAPI:** Async support, handles 10-50 concurrent requests
- **LLM API:** Limited by provider rate limits (typically 500-5000 RPM)
- **Tools:** Thread-safe, can run multiple analyses in parallel

---

## Next Steps

- **[Getting Started](getting_started.md)** - Install and configure FairSense
- **[User Guide](user_guide.md)** - Detailed usage examples
- **[API Reference](api.md)** - Complete API documentation
- **[Developer Guide](developers.md)** - Extend and contribute to FairSense
