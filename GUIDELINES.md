# General Rules

|   # | Constraint                | Rule                                                                                                                                                                                                                                                                                                  |
| --: | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
|   1 | Single source of truth    | a definition appears once, at the most appropriate spot; everywhere else → hyperlink                                                                                                                                                                                                                  |
|   2 | Current state only        | each document describes one version; history lives in version control                                                                                                                                                                                                                                 |
|   3 | `DOC/reference/`          | optional; stores official external documentation as the authoritative source of truth                                                                                                                                                                                                                 |
|   4 | HTML escaping             | escape `&` `<` `>` as entities in content; inside `<pre>/<code>` this is mandatory — unescaped brackets parse as tags and disappear (`Result<T, E>`, ASCII arrows `<--`)                                                                                                                              |
|   5 | Notes                     | supplements under diagrams/tables/file trees/call stacks → `<ul class="note"><li>…</li></ul>` (token `--note` in `DOC/style.css`); notes stay in bullet form                                                                                                                                          |
|   6 | Section layout            | development docs only — opening: qualifying prose (when structure is impossible) · middle: structured content only (code/diagrams/tables) · end: `ul.note` bullets only                                                                                                                               |
|   7 | Comment budget            | an in-code comment with >3 information points → `ul.note` after its code block; the comment keeps only what the signature/call needs                                                                                                                                                                  |
|   8 | One block, one flow       | a code block is a single continuous content; disjoint pieces → separate blocks/subsections                                                                                                                                                                                                            |
|   9 | CONVENTIONS               | a convention joins CONVENTIONS when it affects more than one component and a shared pattern or commonality links them. USER / CORE / PROVIDER each keep one such chapter right after the first chapter (may stay empty); state each convention once there and reference it from the affected sections |
|  10 | BUILD is downstream       | BUILD is generated from ABOUT / USER / CORE / PROVIDER; those documents stay self-contained, and BUILD links back to them. BUILD joins the doc set once development is complete.                                                                                                                      |
|  11 | Documentation-first       | documents define the target design and contract first; implementation follows them. Each document records the target design, independent of implementation status.                                                                                                                                    |
|  12 | Conventions vs exceptions | CONVENTIONS state the shared rule; document each exception in its mechanism / component section and link it from the rule                                                                                                                                                                             |

## Project Structure

```
project/                      project root
├── DOC/                      documentation of this project
├── README.md                 project front page, outside the document set
├── <code roots>              code, tests, and toolchain metadata, in native paths
└── child-project/            subproject root; repeats this layout below itself
```

## Language

- Actual document content can be in any language. It is acceptable for document content to use translation of the terms defined in this documentation. Attached a non-exhaustive table of EN to CN translation for easier coherence.

| EN                                   | CN                   |
| ------------------------------------ | -------------------- |
| `[DONE]`                             | `[已解决]`              |
| `// Recommendation:  15,000`         | `//推荐值：15,000`       |
| `Internal Process`                   | `内部处理`               |
| `//See USER §xx.xx`                  | `//见 USER §xx.xx`    |
| `Add` / `Delete` / `Change` / `None` | `增` / 删 / `改` / `不动` |
| `Description`                        | `描述`                 |
| `Solution`                           | `解决方案`               |
| `Spec Changes`                       | `文档操作`               |
| `Work Notes`                         | `工作记录`               |

## Diagrams: PlantUML

PlantUML is the sole diagram source: Component Diagram, Sequence Diagram, or Activity Diagram with Swimlanes. Other visuals can use actual pictures.
Sources (`*.puml`) and exports (`*.svg`) live in the owning project's `DOC/diagram/` (one folder per project); embed the SVG via `<img>` with a relative path (`diagram/…`).

1. **Form by complexity** — general architecture: Component Diagram · at most one branch decision (<2 nesting levels): Sequence Diagram · more branching: Activity Diagram with Swimlanes, one swimlane per participant
2. **Vertical layout** — write branch-heavy flows as a guard-clause cascade: checks run sequentially and each branch ends `stop`
3. **Labels** — in the documentation language; short messages, details into notes
4. **Source is authoritative** — edit `*.puml`, re-export (`plantuml -tsvg <project>/DOC/diagram/*.puml`), commit both together; the SVG is a generated artifact
5. **Embedding** — wrap in `<div class="diagram">`, natural size, horizontal scroll when wider than the page (same mode as `<pre>`)
6. **Participants** — the project is one participant; draw only boundary-crossing messages; internal processes or components (main/renderer, views, stores, …) belong to CORE; summarize internal processing as one self-loop on the project labeled `Internal Process`

# Spec Guidelines


Spec documentation per project, in HTML — the development docs split by boundary:

| # | Document | Boundary | Content | Elsewhere |
|--:|----------|----------|---------|-----------|
| 1 | [ABOUT](#about) | — | WHAT & WHY · user interactions | — |
| 2 | [USER](#user) | upper — end users / dependent software | protocols · conventions · APIs · workflows · UI & prototypes (graphical programs) | internal mechanics → [CORE](#core) · underlying sources → [PROVIDER](#provider) |
| 3 | [CORE](#core) | internal surface only | internal data structures & APIs · call stacks · SBOM | usage-facing → [USER](#user) · provider boundary → [PROVIDER](#provider) |
| 4 | [PROVIDER](#provider) | lower — underlying data sources / dependencies (system services, IPC, hardware, daemons, network endpoints, …); present when applicable | protocols · conventions · APIs · workflows | whole-system view → [USER](#user) · internal handling → [CORE](#core) |
| 5 | [BUILD](#build) | written after development | how to use & build on the project | — |

`README.md` — the project front page, maintained separately; development work draws on this document set alone.

| Principle | Rule |
|-----------|------|
| Proximity | place a concern at the nearest boundary it directly faces; a direct relationship determines its document |
| End goal | a set of design constraints immediately useful to any developer implementing the code |
| Scope | state the design itself; broad principles carry the rationale |

## Global constraints

[↑](#documentation-guidelines)

## ABOUT

[↑](#documentation-guidelines)

1. **WHAT & WHY** — IDEAL: the problem to solve · GOAL: what success looks like · NON-GOAL: project boundaries and the scope left to others
2. **User interactions** — entry points and user-observable outcomes; mechanisms belong to USER/CORE
3. **Project map** — optional; root project of a multi-project repo only
   - **Scope** — the current project as the root, with every subproject beneath it, recorded recursively
   - **Granularity** — one entry per subproject root folder, without project content
   - **Form** — file tree with a one-sentence comment per entry, stating its role in the project organization
4. **Credits** — always present and last; credit the projects used, with stack/license where useful

## USER

[↑](#documentation-guidelines)

**Rules**
- express requirements as mechanisms; finer requirements that resist a mechanism → complement at the end of the section
- state user-visible behavior; internal mechanism names (cache, probe, queue construction) and engineering constants belong to CORE

**Chapters**
1. **TERMS** — one canonical term per concept with its full definition; later uses stand alone. Should not include design details.
2. **CONVENTIONS** — shared across interfaces (Global constraints #9)
3. **DIAGRAMS** — mechanisms are the preferred documentation form
   - general architecture — how the application interacts with others (Component Diagram)
   - page / URL navigation — Component Diagram with pages as nodes and navigation edges; the diagram replaces a route list in CONVENTIONS
   - workflows — business language; terms/API names only for well-known standards; Sequence Diagram / Activity Diagram with Swimlanes, form per [Diagrams](#diagrams-plantuml)
4. **INTERFACES**
   - exposed API specifications — code, or pseudocode for multi-language support
   - message types incl. errors — pseudocode definition block + table of meaning & suggested action
   - data models — objects of exposed APIs (bare code/pseudocode; the code defines the model) · field table (external specs referenced) · transformations (exact data object names)
5. **UI** — optional; graphical programs only; all UI prototypes/mocks live here
   - prototype/mock — code, pictures or videos
   - palette — color tokens and their semantic roles
   - visual presentation — the per-component visual contract (geometry, states, styling) stated in prose/code; a prototype illustrates it while the written contract governs; the prototype's numbers are illustrative

## CORE

[↑](#documentation-guidelines)

**Rules**

| Topic                 | Rule                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shared symbols        | symbols already defined in USER/PROVIDER → one-line declaration with trailing `//See USER §xx.xx` / `//See PROVIDER §xx.xx` in the project language; all remaining symbols use syntactically valid project language                                                                                                                                        |
| Engineering constants | name & purpose in the owning source file's signature subsection · recommended value as a comment (e.g. `// Recommendation: 15,000`) · flow-specific literal inline in the call stack where that flow depends on it · UI visual literals in USER's UI chapters (CSS/code is the operational source of truth) · one home per constant: its owning subsection |
| Naming source         | implementation reference (main branch, breadpan, std / GTK APIs) → real names · new contract → drafted names/signatures, with implementation preserving documented semantics and call stacks using the drafted names                                                                                                                                       |

**Chapters**
1. **File tree** — final code structure; each entry states what the module serves and links to its signatures subsection where one exists; covers source/build/config/assets; documentation artifacts and styling live outside CORE
2. **CONVENTIONS** — shared across interfaces (Global constraints #9)
3. **SBOM** — dependency libraries in one table: name · what it serves in this project; version & license stay in the package manifest
4. **Internal types & method signatures** — one subsection per source file, in file-tree order, titled by file name and linking back to the file tree
   - methods: signature + at most one line of purpose; cover every method in a core flow; non-core helpers are optional; internals (call chains, branching, fallbacks, ordering) live in the call-stack section
   - data structures & messages: type definitions whose comments carry the explanation and whose fields sit in the definition
5. **Call stack tree** — actual execution of key program logic: startup, key events, shutdown
   - lines carry calls or judgments only — every line points at a concrete call (`module::fn(args)`, DBus method, event send, …); a judgment/branch condition is the sole exception
   - one line carries at most one call or one judgment; a judgment may point to its single resulting call; independent calls are separate sibling/child lines; equivalent entrypoints may share one line separated by `/`
   - event listeners are represented by the binding call statement; calls inside the listener are child calls, like any other call
   - a node's children are calls made by that node; a path shared by several callers becomes a separate root/subsection
   - structure follows the source: separately registered listeners stay separate; a semantic grouping such as `player.on(command)` lives in a note/table and complements the actual registrations
   - at most one trailing comment per call, placed on the call's line; the ancestor spine `│` continues through that line
   - motivations, policies, trade-offs beyond one comment line → prose after the block

## PROVIDER

[↑](#documentation-guidelines)

**Rules**
- contractual = the consumed subset; link the official documentation as the authoritative definition (mirror in `reference/` when applicable)
- workflow diagrams name the provider's methods/messages crossing the boundary; internal call structure belongs to CORE

**Chapters**
1. **TERMS** — one canonical term per concept with its full definition; later uses stand alone
2. **CONVENTIONS** — shared across the provider boundary (Global constraints #9)
3. **DIAGRAMS** — boundary workflows; Sequence Diagram / Activity Diagram with Swimlanes, form per [Diagrams](#diagrams-plantuml)
4. **INTERFACES**
   - consumed API specifications — code, or pseudocode for multi-language support
   - message types sent/received on this boundary, incl. errors — pseudocode definition block + table of meaning & suggested action
   - data models — objects crossing this boundary (bare code/pseudocode; the code defines the object) · field table (external spec as authority) · transformations between provider ↔ project data objects (exact names)

## BUILD

[↑](#documentation-guidelines)

**Rules**
- guides other developers in using and building on the project
- organize BUILD content by target platform: one subsection per platform (Ubuntu · Arch Linux · Windows · …)
- generated from ABOUT / USER / CORE / PROVIDER (Global constraints #10)

**Chapters**
1. **Developer setup** — toolchain, system dependencies, environment configuration
2. **Development commands** — build, test, package, and other development tasks
3. **Installation guide** — one subchapter per route, e.g.
   - from source
   - one-click script
   - package manager
   - other distribution channels
4. **Supplementary notes** — remaining developer-facing details
# Development Guidelines

[↑](#documentation-guidelines)

- They're all intermediary documentations in Markdown format, and does not follow the Spec Guidelines.
## TODO
- A simple list of major changes to the project. Typically: new features, component changes, code logic overhaul.
- After completion, each entry is marked `[DONE]` for later removal.
## ISSUE
- A simple list of minor issues found. Typically: bugs, QoL improvements, interactions.
- After completion, each entry is marked `[DONE]` for later removal.
## IMPL
A record of work done to the specs during resolution of TODOs and ISSUEs. Each entry is formatted as:
  - `Description`: a paragraph, summarizing the issue/requirement.
  - `Solution`: a bulleted list of what to implement.
  - `Spec Changes `: a table with the following fields: Doc name, Section, Action (` Add ` / ` Delete ` / ` Change ` / ` None `, ` None ` is for when relevant action is completed in another entry, in order to avoid overwriting each other's work), Content (the exact alteration to the text)
  - `Work Notes` (Optional): bulleted list of additional records of the actual work done to the specs. Useful when the Spec Changes differs from the real specs, and has to be amended.