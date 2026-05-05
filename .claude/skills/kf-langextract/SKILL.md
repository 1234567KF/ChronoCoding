---
name: kf-langextract
description: >-
  Use when the user pastes or provides unstructured text and wants structured data extracted from it — entities, fields, relationships, tables, or bespoke JSON schemas.
  Use when the user says "extract", "parse", "结构化提取", "提取数据", "结构化", "turn this into JSON/CSV/YAML", "parse this text",
  or pastes unformatted text blocks (logs, clinical notes, financial reports, legal docs, articles, transcripts) where structured output would be more useful.
  Uses google/langextract — LLM-powered extraction with precise source grounding (every value maps back to its location in the original text).

  Do NOT use for: general Q&A, summarization, translation, rewriting, style conversion, or sentiment analysis without extraction.
metadata:
  pattern: tool-wrapper+generator+pipeline
  steps: "4"
  extraction-model: "gemini-2.5-flash"
  integrated-skills:
    - kf-model-router
compatibility: Requires Python 3.10+ and `pip install langextract`
---

You are a structured extraction specialist. Your job: take unstructured text and produce grounded structured data using the `langextract` library.

## Core Principle

Every extracted value MUST be traceable to its source. `lx.extract()` returns `char_interval` on each `Extraction` — preserve and present this grounding. If a value can't be grounded, note it rather than fabricating.

## Step 1 — Setup

Check `langextract` is available:

```bash
python -c "import langextract; print(langextract.__version__)" 2>/dev/null || echo "NOT_INSTALLED"
```

If NOT_INSTALLED, install it:

```bash
pip install langextract
```

If installing behind a proxy or on Windows with path issues, fall back to `python -m pip install langextract`.

If the user wants OpenAI models, use `pip install langextract[openai]` instead.

## Step 2 — Define Schema & Examples

`lx.extract()` requires **both** a `prompt_description` string **and** a list of `ExampleData` (few-shot examples). Do NOT skip examples.

### 2a — Determine what to extract

Ask the user (infer from context when possible — only ask if genuinely ambiguous):

1. **Entity types**: What kind of things to extract? (people, dates, codes, amounts, diagnoses, etc.)
2. **Output format**: JSON file, inline display, CSV, YAML? (default: JSON + inline table)
3. **Model preference**: gemini-2.5-flash (default, no extra config), gpt-4o (needs `OPENAI_API_KEY`), or local via Ollama?

If the user is vague ("just extract everything useful"), propose a reasonable schema based on the text content.

### 2b — Build examples

For each example, provide:
- **Source text** (short snippet with the entity)
- **Expected extractions** — what the correct output looks like

Use this pattern:

```python
import langextract as lx

examples = [
    lx.data.ExampleData(
        text="<source snippet with entity>",
        extractions=[
            lx.data.Extraction(
                extraction_class="<entity-type>",
                extraction_text="<exact verbatim text>",
                attributes={"<key>": "<value>"}
            ),
        ]
    ),
    # 2-3 examples minimum for reliable extraction
]
```

Load `references/extraction-templates.md` for domain-specific example templates (clinical, financial, legal, log parsing).

### 2c — Write the prompt_description

Write a clear natural-language description of what to extract and any rules:

> "Extract all medication prescriptions from this clinical note. Include drug name, dosage, frequency, and route. Ignore over-the-counter medications unless explicitly prescribed."

## Step 3 — Run Extraction

Generate and execute a Python script. Load `references/api-reference.md` for the full API. Pattern:

```python
import langextract as lx

source_text = """<paste or read from file>"""

examples = [ ... ]  # from Step 2

result = lx.extract(
    text_or_documents=source_text,
    prompt_description="<your_prompt>",
    examples=examples,
    model_id="gemini-2.5-flash",  # or gpt-4o, gemma2:2b, etc.
    extraction_passes=2,           # 2+ passes for better recall
)

# Save results
lx.io.save_annotated_documents([result], output_name="extraction_output", output_dir=".")

# Print summary
print(f"Extracted {len(result.extractions)} entities")
grounded = [e for e in result.extractions if e.char_interval is not None]
ungrounded = [e for e in result.extractions if e.char_interval is None]
print(f"  Grounded: {len(grounded)}")
print(f"  Ungrounded: {len(ungrounded)}")

for e in result.extractions:
    print(f"  [{e.extraction_class}] \"{e.extraction_text}\"")
    if e.char_interval:
        print(f"    Source: chars {e.char_interval}")
    if e.attributes:
        print(f"    Attributes: {e.attributes}")
```

Handle special cases:
- **Long text** (>100K chars): Pass URL or file path directly; `langextract` auto-chunks
- **URL source**: Pass the URL as `text_or_documents` — the library fetches it
- **Batch files**: Pass a list of strings for parallel processing
- **API key not set**: Guide the user to set `LANGEXTRACT_API_KEY` or fall back to Ollama

### 3a — Model Selection

| Model | API Key | Install | Notes |
|-------|---------|---------|-------|
| `gemini-2.5-flash` | `LANGEXTRACT_API_KEY` | `pip install langextract` | Default, best speed/quality |
| `gemini-2.5-pro` | `LANGEXTRACT_API_KEY` | `pip install langextract` | Deeper reasoning on complex texts |
| `gpt-4o` | `OPENAI_API_KEY` | `pip install langextract[openai]` | OpenAI alternative |
| `gemma2:2b` | None | `pip install langextract` + Ollama | Local, no API key needed |

Run the script with `python` (not `python3` on Windows). Capture the output.

## Step 4 — Review & Export

Present results to the user:

1. **Summary**: Total entities extracted, grounded vs ungrounded count
2. **Results table**: Entity class, extracted text, source position, attributes
3. **Notable ungrounded values**: Fields with `char_interval=None` — these may need schema adjustment
4. **Source trace**: For any entity, show the original text it came from

Ask:
- "Extractions look accurate? Any false positives or misses?"
- "Adjust schema / add more examples and re-run?"
- "Generate the interactive HTML visualization?"
- "Export to JSON/CSV/YAML file?"

For visualization:

```python
html_content = lx.visualize("extraction_output.jsonl")
with open("extraction_visualization.html", "w") as f:
    content = html_content.data if hasattr(html_content, 'data') else html_content
    f.write(content)
```

## Gotchas

- `langextract` requires `LANGEXTRACT_API_KEY` env var for Gemini models. Load from `.env` is supported but `os.environ` set is more reliable in script context.
- `examples` is **required** — not optional. The library needs at least 1 `ExampleData` to define what to extract. If the user can't provide examples, construct them from the text and ask user to validate.
- On Windows: use `python` not `python3`. If `pip` fails, use `python -m pip`.
- Large extraction jobs benefit from `extraction_passes=3` and `max_workers=20` for better recall on long documents.
- The `char_interval` field is `None` when the extraction CANNOT be grounded in the source — this is intentional, not a bug. Use this to detect hallucinated values.
- For Vertex AI users, pass `language_model_params={"vertexai": True, "project": "your-project", "location": "global"}`.
- If the script crashes with "model not found", the model_id may need the full provider prefix (e.g., `gemini/gemini-2.5-flash` for certain configs).
