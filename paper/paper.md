---
title: 'FairSense-AgentiX: An Agentic Platform for Multi-Modal Fairness and AI Risk Analysis'
tags:
  - Python
  - fairness
  - bias detection
  - agentic AI
  - responsible AI
  - risk assessment
  - natural language processing
  - computer vision
authors:
  - name: Aravind Narayanan
    orcid: 0009-0008-7991-1929
    equal-contrib: true
    affiliation: 1
  - name: Karanpal Sekhon
    equal-contrib: true
    affiliation: 1
  - name: Mahshid Alinoori
    affiliation: 1
  - name: Shaina Raza
    orcid: 0000-0003-1061-5845
    corresponding: true
    affiliation: 1
affiliations:
  - name: Vector Institute for Artificial Intelligence, Toronto, Ontario, Canada
    index: 1
    ror: 02e5yfp61
date: 27 April 2026
bibliography: paper.bib
---

# Summary

FairSense-AgentiX is an open-source Python platform for automated detection of
bias in text and images and for assessing AI deployment scenarios against
established risk frameworks. Existing fairness tools such as AI Fairness 360
[@8843908], Fairlearn [@JMLR:v24:23-0389], and LangFair [@Bouchard2025]
address structured datasets or LLM output metrics but cannot audit unstructured
content across text and images, explain their reasoning transparently, or connect
findings to deployment-level risk frameworks in a single workflow. To address this
gap, it implements a multi-node agentic workflow using LangGraph [@langgraph]---unlike
static classifiers or rule-based checkers---in which a reasoning agent plans its
analysis strategy, selects tools dynamically, executes them, and iteratively refines
its output through a self-critique loop. The platform supports three analysis
modes---text bias detection, image bias detection, and AI risk assessment---and
exposes both a Python library and a FastAPI [@fastapi] REST/WebSocket server with an
accompanying React web interface. FairSense-AgentiX is designed to be
LLM-provider-agnostic and tool-swappable, making it applicable in a wide range of
research and production contexts. It builds on and substantially extends a prior
static pipeline, FairSense-AI [@raza2025fairsenseairesponsibleaimeets], by replacing single-pass LLM
inference with an orchestrated, self-correcting agentic loop and adding a
retrieval-augmented risk assessment module tied to established governance frameworks.

# Statement of Need

Three concrete gaps motivate FairSense-AgentiX:

**Multi-modal coverage.** Real-world content includes job advertisements with
embedded images, presentations combining visual and textual claims, and deployment
documentation. A text-only auditing tool misses a significant portion of potential
bias surface area.

**Transparent reasoning.** Compliance-oriented use cases---hiring audits, content
moderation pipelines, ML model governance---require not just a verdict but an
explanation: which exact text spans are problematic, why, and how confident the
system is. Black-box classification cannot satisfy this need.

**Connection to risk frameworks.** Detecting bias is necessary but not sufficient;
practitioners also need to understand how a deployment scenario maps to established
taxonomies such as the NIST AI Risk Management Framework [@nist2023rmf] and the MIT
AI Risk Repository [@SLATTERY2026101517]. No prior open-source tool integrates bias
detection with retrieval-augmented risk mapping.

FairSense-AgentiX addresses these gaps in a single, cohesive platform that is
thoroughly tested and documented for external adoption.

# State of the Field

Fairness auditing of AI systems and content remains an active area of research
that lacks mature, end-to-end tooling [@mehrabi2021; @blodgett2020language].
Existing libraries such as AI Fairness 360 [@8843908] and Fairlearn
[@JMLR:v24:23-0389] provide statistical metrics and post-hoc debiasing algorithms
for structured datasets but do not address unstructured text or images, and offer
no pathway to natural-language explanations or deployment-level risk guidance. More
recently, LangFair [@Bouchard2025] introduced LLM-specific fairness metrics for
text outputs, but remains restricted to evaluating LLM responses against predefined
prompts and provides no image modality, no agentic reasoning, and no connection to
deployment-level risk frameworks. Across these tools, existing approaches suffer
from one or more of the following limitations: they are restricted to a single
modality, they rely on fixed rule sets that cannot adapt to context, they treat
analysis as a black-box step with no transparency into reasoning, or they provide
no pathway from detected issues to actionable risk management guidance.

**Why a new package rather than an extension.** The gaps above are architectural
rather than additive: AI Fairness 360 and Fairlearn are organised around tabular
datasets and statistical metrics, with no abstraction for unstructured content, no
orchestrator for multi-step reasoning, and no retrieval layer for external risk
taxonomies. Adding these capabilities would require restructuring their core data
model rather than extending it. LangFair is similarly scoped to LLM input/output
pairs and prompt-level metrics, with no notion of auditing a document or image as
a unit. FairSense-AgentiX is therefore best released as a separate package that
interoperates with these tools (e.g., exporting structured findings for downstream
Fairlearn analysis) rather than as a fork or extension of any one of them.

# Software Design

## Agentic Orchestration

The core of FairSense-AgentiX is an orchestrator built with LangGraph that
implements a Reason--Act--Observe--Reflect (ReAct) loop [@yao2023react].
\autoref{fig:orchestrator} shows the full graph topology.

![Orchestrator graph topology showing the seven-node ReAct loop with conditional routing between planning, execution, evaluation, refinement, and finalisation.\label{fig:orchestrator}](orchestrator_graph_topology_fairsense.png)

The `request_plan` node uses an LLM to classify the input modality and produce a
routing decision with a confidence score and human-readable reasoning.
`preflight_eval` checks whether the planned execution is coherent before committing
resources. `execute_workflow` then dispatches to the selected specialised subgraph,
and `posthoc_eval` scores the returned output on completeness, factual grounding,
and span precision. When quality falls below threshold and refinement is enabled,
`decide_action` routes back to `apply_refinement`, which adjusts the plan and
re-enters the loop; otherwise control passes to `finalize`. This critique-driven
refinement loop [@madaan2023selfrefine] is the key architectural differentiator: it
converts what would otherwise be a single-pass inference into an iterative,
self-correcting process.

## Specialised Workflow Subgraphs

Three workflow subgraphs handle distinct analysis tasks.

**Text bias graph.** Accepts raw text, invokes an LLM with structured output to
identify bias instances (type, severity, character-level span, explanation),
optionally summarises long documents, and produces colour-coded HTML highlighting.
Bias categories covered include gender, age, racial, disability, and socioeconomic
bias [@blodgett2020language; @mehrabi2021].

**Image bias graph.** Runs OCR (Tesseract [@smith2007tesseract] or PaddleOCR
[@paddleocr2020]) and image captioning (BLIP [@li2022blip] or BLIP-2 [@li2023blip2])
in parallel, merges the resulting text, and feeds it into the same LLM-based
analysis pipeline as the text workflow. A Vision-Language Model (VLM) variant uses
the full image directly rather than the extracted-text intermediary.

**Risk assessment graph.** Embeds a natural-language deployment scenario using a
sentence-transformer model [@reimers2019sbert], performs semantic nearest-neighbour
search over a FAISS [@johnson2019faiss] index of 1,340 risks drawn from the MIT AI
Risk Repository v3 [@SLATTERY2026101517], retrieves corresponding NIST AI-RMF
[@nist2023rmf] mitigation recommendations from a second FAISS index per matched
risk, and exports results as an HTML table and CSV file.

## Tool Registry and Dependency Injection

All tools---OCR, captioning, summarisation, LLM, VLM, embedder, FAISS indexes,
formatter, and persistence---are constructed by a central `ToolRegistry` from
configuration and injected into each subgraph at build time. This design decouples
graph logic from tool implementation and enables runtime substitution: the entire
tool stack can be replaced with lightweight fakes for unit testing without modifying
graph code. 

LLM providers (OpenAI GPT-4 [@openai2024gpt4technicalreport] and Anthropic Claude 
[@anthropic2024claude], via LangChain [@chase2022langchain]) are 
selected through environment variables, with no code changes required to switch providers.

## Service Layer

FairSense-AgentiX exposes a high-level `FairSense` Python class with three
methods---`analyze_text`, `analyze_image`, and `assess_risk`---that return typed
Pydantic result objects (`BiasResult`, `RiskResult`). These objects carry execution
metadata including run ID, router confidence, refinement count, and quality scores,
enabling fine-grained observability. The FastAPI service layer wraps this API and
additionally streams agent telemetry events over WebSocket, so clients can observe
each reasoning step as it occurs. A React/TypeScript frontend provides a landing
page and interactive analysis interface with pre-built demo examples for each mode.

## Quality Assurance

The package ships with a comprehensive test suite covering unit tests for every
tool, integration tests for each subgraph and the orchestrator, stress tests, and a
benchmarking harness that measures p50/p95/p99 latency and memory usage across input
sizes. Pre-commit hooks enforce type-checking (`mypy`) and linting (`ruff`) before
every commit, and GitHub Actions runs the integration test suite on every pull
request.

# Research Impact Statement

FairSense-AgentiX was developed under the AIXPERT project, a Horizon Europe
initiative (Grant Agreement No. 101214389) tasked with building explainable,
accountable, and transparent AI systems. Within this project, FairSense-AgentiX
serves as the reference implementation of the agentic fairness-and-risk analysis
layer, and is the basis for our ongoing empirical work on critique-driven refinement
in fairness auditing.

The platform's research utility derives from three concrete design choices. First,
it operationalises the MIT AI Risk Repository [@SLATTERY2026101517]---a peer-reviewed
taxonomy of over 1,300 documented AI risks---as a queryable, FAISS-backed retrieval
system, making the taxonomy directly usable in downstream studies rather than as a
static document. Second, it bridges this risk taxonomy to the NIST AI Risk Management
Framework [@nist2023rmf], providing per-risk mitigation recommendations that can be
cited and traced in audit reports. Third, the LangGraph-based orchestrator exposes
every intermediate reasoning step (router decisions, tool selections, preflight and
post-hoc evaluation scores, refinement-loop deltas), enabling reproducible analysis
of agent behaviour---a prerequisite for empirical studies of agentic systems that
black-box pipelines cannot support.

The package is distributed on PyPI as `fairsense-agentix` under the MIT License and
is actively maintained on GitHub with continuous integration and versioned releases. Developed under the AIXPERT project, FairSense-AgentiX
provides the research community with the first open-source, end-to-end auditing
harness that combines multi-modal bias detection with retrieval-augmented risk
mapping---infrastructure we expect to underpin forthcoming empirical work on agentic
fairness auditing.

# Limitations

At present, FairSense-AgentiX supports five bias categories (gender, age, racial,
disability, socioeconomic), operates over English-language prompts and risk
taxonomies, and integrates only with closed-source LLM providers (OpenAI GPT-4 [@openai2024gpt4technicalreport] and
Anthropic). Quantitative evaluation against standard fairness benchmarks is not
included in this work and is planned as a companion study.

# AI Usage Disclosure

No generative AI was used for architectural design or core algorithms. Claude
(Anthropic) and GitHub Copilot were used for creating documentation and docstrings,
bug fixing, and inline code changes. For this manuscript, these tools were used for
drafting, copy-editing, and consistency checking; all factual claims were verified
by the authors against the codebase.

# Acknowledgements

Resources used in preparing this research were provided, in part, by the Province
of Ontario, the Government of Canada through CIFAR, and companies sponsoring the
Vector Institute (<http://www.vectorinstitute.ai/#partners>). This research was
funded by the European Union's Horizon Europe research and innovation programme
under the AIXPERT project (Grant Agreement No. 101214389), which aims to develop
an agentic, multi-layered, GenAI-powered framework for creating explainable,
accountable, and transparent AI systems.

# References