# google/langextract Python API Reference

> Installed via `pip install langextract`. Version 1.3.0+.

## Import

```python
import langextract as lx
```

## Core Data Types

### `lx.data.ExampleData`

A single few-shot example with source text and expected extractions.

| Param | Type | Required |
|-------|------|----------|
| `text` | str | Yes |
| `extractions` | list[Extraction] | Yes |

```python
lx.data.ExampleData(
    text="ROMEO. But soft! What light through yonder window breaks?",
    extractions=[
        lx.data.Extraction(
            extraction_class="character",
            extraction_text="ROMEO",
            attributes={"emotional_state": "wonder"}
        ),
    ]
)
```

### `lx.data.Extraction`

A single extracted entity.

| Attribute | Type | Description |
|-----------|------|-------------|
| `extraction_class` | str | Entity type label |
| `extraction_text` | str | Verbatim text from source |
| `attributes` | dict | Additional key-value context |
| `char_interval` | tuple or None | `(start, end)` char span in source; `None` = ungrounded |

## Extraction API

### `lx.extract()`

```python
def extract(
    text_or_documents: str | list[str] | URL,
    prompt_description: str,
    examples: list[ExampleData],
    model_id: str = "gemini-2.5-flash",
    extraction_passes: int = 1,
    max_workers: int = 10,
    max_char_buffer: int = 2000,
    api_key: str | None = None,
    language_model_params: dict | None = None,
    config: ModelConfig | None = None,
    model_url: str | None = None,
    fence_output: bool | None = None,
    use_schema_constraints: bool | None = None,
) -> ExtractionResult
```

**Key Parameters:**

| Param | Default | Notes |
|-------|---------|-------|
| `text_or_documents` | — | String, list of strings, or URL |
| `prompt_description` | — | Natural language extraction rules |
| `examples` | — | **Required.** List of ExampleData (min 1) |
| `model_id` | `gemini-2.5-flash` | See model table below |
| `extraction_passes` | 1 | Increase for better recall on complex docs |
| `max_workers` | 10 | Parallel processing threads |
| `max_char_buffer` | 2000 | Smaller = more focused per-chunk extraction |
| `model_url` | None | Ollama endpoint, e.g. `http://localhost:11434` |

### Result

```python
result.extractions  # list of Extraction objects
```

### Save results

```python
lx.io.save_annotated_documents([result], output_name="name", output_dir=".")
# Produces: name.jsonl, name.json
```

## Visualization

```python
html_content = lx.visualize("name.jsonl")
with open("viz.html", "w") as f:
    content = html_content.data if hasattr(html_content, 'data') else html_content
    f.write(content)
```

## Model Support

| Model | Provider | Needs Key | Install |
|-------|----------|-----------|---------|
| `gemini-2.5-flash` | Gemini | `LANGEXTRACT_API_KEY` | `pip install langextract` |
| `gemini-2.5-pro` | Gemini | `LANGEXTRACT_API_KEY` | `pip install langextract` |
| `gpt-4o` | OpenAI | `OPENAI_API_KEY` | `pip install langextract[openai]` |
| `gemma2:2b` | Ollama | None | +Ollama running |

### Custom provider

```python
from langextract.factory import ModelConfig
config = ModelConfig(
    model_id="my-model",
    provider="openai",
    provider_kwargs={"api_key": "...", "base_url": "https://..."},
)
```

### Vertex AI

```python
language_model_params={
    "vertexai": True,
    "project": "my-project",
    "location": "global",
    "batch": {"enabled": True}
}
```

## Env Variables

| Variable | Purpose |
|----------|---------|
| `LANGEXTRACT_API_KEY` | Gemini API key |
| `OPENAI_API_KEY` | OpenAI API key |

Also reads from `.env` file automatically.
