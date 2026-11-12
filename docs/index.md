<div class="fs-hero" markdown>

# FairSense-AgentiX

<p class="fs-lead">
An open-source platform from the <strong>Vector Institute</strong> for multi-modal bias detection,
explainable fairness auditing, and retrieval-based mapping of deployment scenarios to the
<a href="https://airisk.mit.edu/">MIT AI Risk Repository</a> and NIST AI RMF.
</p>

<div class="fs-badges" markdown>
[![JOSS](assets/joss-status.svg)](https://doi.org/10.21105/joss.11060)
[![PyPI](https://img.shields.io/pypi/v/fairsense-agentix?color=48c0d9&label=PyPI)](https://pypi.org/project/fairsense-agentix/)
[![Zenodo](https://img.shields.io/badge/Zenodo-10.5281%2Fzenodo.23106857-1682C9)](https://doi.org/10.5281/zenodo.23106857)
[![Docs CI](https://github.com/VectorInstitute/fairsense-agentix/actions/workflows/docs.yml/badge.svg)](https://github.com/VectorInstitute/fairsense-agentix/actions/workflows/docs.yml)
</div>

<div class="fs-actions" markdown>
[Get started :octicons-arrow-right-24:](getting_started.md){ .md-button .md-button--primary }
[Run the UI :octicons-arrow-right-24:](server.md){ .md-button }
[JOSS paper :octicons-link-external-16:](https://joss.theoj.org/papers/10.21105/joss.11060){ .md-button }
[GitHub :fontawesome-brands-github:](https://github.com/VectorInstitute/fairsense-agentix){ .md-button }
</div>

</div>

!!! success "Peer-reviewed open-source software"
    FairSense-AgentiX was **published** in the [Journal of Open Source Software](https://joss.theoj.org/) on 30 October 2026
    ([DOI: 10.21105/joss.11060](https://doi.org/10.21105/joss.11060)).
    Software archive: [Zenodo 10.5281/zenodo.23106857](https://doi.org/10.5281/zenodo.23106857) (release **v0.2.2**).
    If you use this work in research, please cite the [JOSS paper](https://doi.org/10.21105/joss.11060).

---

## What is FairSense-AgentiX?

FairSense-AgentiX detects bias in **text** and **images** and assesses **AI deployment scenarios**
against established risk frameworks. It uses a [LangGraph](https://langchain-ai.github.io/langgraph/)
orchestrator with a **critique-and-refine** loop—not a single-pass black-box classifier—so results
include spans, explanations, scores, and step-by-step telemetry when you use the API or UI.

An orchestrator **routes** each request by declared modality (text, image, or scenario), runs the
matching workflow, **evaluates** output quality with an LLM critic, and optionally **refines** before
finalizing. Tools (OCR, vision models, embeddings, FAISS, LLMs) are injected via a registry so the
same graphs run with real providers in production or lightweight fakes in CI.

---

## Analysis modes

<div class="grid cards" markdown>

-   :material-text-box-search:{ .vector-icon } __Text bias__

    ---

    Structured instances (type, severity, span, explanation) and HTML highlights.

    [:octicons-arrow-right-24: User guide](user_guide.md#text-bias-analysis)

-   :material-image-search:{ .vector-icon } __Image bias__

    ---

    OCR/captioning or a vision-language path, then the same bias pipeline as text.

    [:octicons-arrow-right-24: User guide](user_guide.md#image-bias-analysis)

-   :material-shield-search:{ .vector-icon } __Risk assessment__

    ---

    Semantic search over 1,340 MIT AI Risk Repository (V3) risks plus NIST AI RMF–aligned actions.

    [:octicons-arrow-right-24: User guide](user_guide.md#risk-assessment)

</div>

---

## Key capabilities

### :material-graph-outline: Agentic orchestration

- Modality-based routing into specialised LangGraph subgraphs
- Post-hoc LLM evaluation (0–100) with configurable refinement
- WebSocket telemetry for live agent timelines in the [React UI](server.md)

### :material-api: Production APIs

- Python `FairSense` API · FastAPI REST · batch jobs · [full API reference](api.md)

### :material-tune: Configurable stack

- LLM providers (OpenAI, Anthropic, OpenAI-compatible endpoints) or `fake` for tests
- Swappable OCR/caption/embedder tools via environment variables

---

## How it works

Every request follows the same orchestrator loop: **route → execute → evaluate → deliver** (with an optional refine pass when the critic score is low).

<div class="fs-flowbar" markdown>
<span class="fs-flowbar__chip fs-flowbar__chip--term">Input</span>
<span class="fs-flowbar__sep" aria-hidden="true"></span>
<span class="fs-flowbar__chip">Route</span>
<span class="fs-flowbar__sep" aria-hidden="true"></span>
<span class="fs-flowbar__chip">Execute</span>
<span class="fs-flowbar__sep" aria-hidden="true"></span>
<span class="fs-flowbar__chip">Evaluate</span>
<span class="fs-flowbar__sep" aria-hidden="true"></span>
<span class="fs-flowbar__chip fs-flowbar__chip--term">Results</span>
</div>

<p class="fs-flowbar__loop"><span class="fs-flowbar__loop-badge">Refine</span> may send the request back to <strong>Route</strong> when quality is below threshold (capped).</p>

<div class="grid cards" markdown>

-   :material-sign-direction:{ .vector-icon } __1 · Route__

    ---

    Choose **text**, **image**, or **risk** workflow from the request and run preflight checks.

-   :material-play-circle:{ .vector-icon } __2 · Execute__

    ---

    Run the LangGraph subgraph: bias pipeline, OCR/VLM path, or FAISS over 1,340 MIT risks.

-   :material-clipboard-check:{ .vector-icon } __3 · Evaluate__

    ---

    LLM critic scores output (0–100). Fail → refine; pass → finalize.

-   :material-package-variant:{ .vector-icon } __4 · Deliver__

    ---

    Spans, explanations, highlights, risk matches, and agent telemetry.

</div>

[:octicons-arrow-right-24: Full orchestrator diagram](architecture.md){ .md-button }

---

## Quick start

=== "PyPI"

    ```bash
    pip install fairsense-agentix
    export FAIRSENSE_LLM_PROVIDER=openai
    export FAIRSENSE_LLM_API_KEY=sk-...
    ```

=== "Source"

    ```bash
    git clone https://github.com/VectorInstitute/fairsense-agentix.git
    cd fairsense-agentix
    uv sync && source .venv/bin/activate
    ```

!!! warning "Configure a real LLM provider first"
    The default `FAIRSENSE_LLM_PROVIDER` is `fake` (synthetic placeholders for tests). See
    [Getting Started](getting_started.md) before running real analyses.

```python
from fairsense_agentix import FairSense

engine = FairSense()
result = engine.analyze_text(
    "We're looking for a young, energetic developer to join our startup team."
)
print(result.summary)
```

[:octicons-arrow-right-24: Full getting started guide](getting_started.md){ .md-button .md-button--primary }

---

## Documentation map

| Guide | Description |
| --- | --- |
| [Getting Started](getting_started.md) | Install, `.env`, first analysis |
| [User Guide](user_guide.md) | Text, image, and risk workflows |
| [Server Guide](server.md) | FastAPI + React UI |
| [Architecture](architecture.md) | Graphs, tools, orchestrator |
| [API Reference](api.md) | Python and REST |
| [Developer Guide](developers.md) | Contributing and extending |

---

## Use cases

<div class="grid cards" markdown>

-   :material-bullhorn:{ .vector-icon } __Content & marketing__

    ---

    Moderation pipelines, ad copy, and inclusivity reviews before publish.

-   :material-briefcase:{ .vector-icon } __HR & policy__

    ---

    Job posts, internal communications, and DEI alignment checks.

-   :material-rocket-launch:{ .vector-icon } __ML governance__

    ---

    Pre-deployment risk mapping, audit trails, and fairness research with agent metadata.

</div>

---

## Citation

If you use FairSense-AgentiX in academic work, please cite the JOSS article:

```bibtex
@article{Narayanan2026,
  doi = {10.21105/joss.11060},
  url = {https://doi.org/10.21105/joss.11060},
  year = {2026},
  publisher = {The Open Journal},
  volume = {11},
  number = {126},
  pages = {11060},
  author = {Narayanan, Aravind and Sekhon, Karanpal and Alinoori, Mahshid and Raza, Shaina},
  title = {FairSense-AgentiX: An Agentic Platform for Multi-Modal Fairness and AI Risk Analysis},
  journal = {Journal of Open Source Software}
}
```

---

## License & support

MIT License · [Issues](https://github.com/VectorInstitute/fairsense-agentix/issues) ·
[Contributing](https://github.com/VectorInstitute/fairsense-agentix/blob/main/CONTRIBUTING.md)

**Built with :material-heart: by the Vector Institute AI Engineering team.**
