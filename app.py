import os
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from openai import OpenAI
from dotenv import load_dotenv

import prompts

load_dotenv()

app = Flask(__name__)

# OpenAI-compatible API (any provider: Poe, OpenAI, local proxy, etc.)
client = OpenAI(
    api_key=os.environ.get("API_KEY") or os.environ.get("POE_API_KEY"),
    base_url=os.environ.get("API_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1",
)

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")


def _resolve_log_path():
    env_path = os.environ.get("EASYLANG_LOG")
    if env_path:
        parent = os.path.dirname(env_path)
        if parent:
            os.makedirs(parent, exist_ok=True)
        return env_path
    os.makedirs(LOG_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    return os.path.join(LOG_DIR, f"easylang_{stamp}.log")


LOG_PATH = _resolve_log_path()


def append_log(kind, fields, response_text=None, error=None):
    """Append one search/explain entry to the current session log file."""
    try:
        lines = [
            "",
            f"{'=' * 60}",
            f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  {kind}",
            f"{'=' * 60}",
        ]
        for key, value in fields.items():
            if value is None or value == "":
                continue
            text = str(value)
            if "\n" in text:
                lines.append(f"{key}:")
                lines.append(text)
            else:
                lines.append(f"{key}: {text}")
        if error is not None:
            lines.append(f"error: {error}")
        elif response_text is not None:
            lines.append("response:")
            lines.append(response_text)
        lines.append("")
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write("\n".join(lines))
    except Exception as e:
        print(f"Failed to write log: {e}")

DEFAULT_LANGUAGES = ["Chinese", "English", "French", "German", "Polish", "Russian"]

_FALLBACK_MODELS = [
    "Claude-Haiku-4.5",
    "Claude-Opus-4.8",
    "Claude-Sonnet-4.6",
    "Gemini-3.1-Flash-Lite",
    "Gemini-3.5-Flash-Lite",
    "Gemini-3.7-Flash",
    "GPT-5.4",
    "GPT-5.4-Mini",
    "GPT-5.4-Nano",
    "Grok-4.1-Fast-Reasoning",
    "Grok-4.6",
    "MiMo-V2-Flash",
]


def _load_models_from_env():
    raw = os.environ.get("API_MODELS", "")
    models = [m.strip() for m in raw.split(",") if m.strip()]
    if not models:
        models = list(_FALLBACK_MODELS)
    # Stable A–Z order for the Settings dropdown
    models = sorted(dict.fromkeys(models), key=str.casefold)
    default = (os.environ.get("API_DEFAULT_MODEL") or "").strip()
    if not default or default not in models:
        default = models[0]
    return models, default


ALLOWED_MODELS, DEFAULT_MODEL = _load_models_from_env()

DIFFICULTY_LABELS = ["Easy", "Medium", "Hard", "Advanced", "Expert", "Native", "Literary"]

def _resolve_model(requested):
    if requested in ALLOWED_MODELS:
        return requested
    return DEFAULT_MODEL

@app.route("/")
def index():
    return render_template("index.html", languages=DEFAULT_LANGUAGES)

@app.route("/models", methods=["GET"])
def models():
    return jsonify({"models": ALLOWED_MODELS, "default": DEFAULT_MODEL})

@app.route("/search", methods=["POST"])
def search():
    data = request.json
    phrase = data.get("phrase", "")
    num_examples = data.get("num_examples", 3)
    languages = data.get("languages", DEFAULT_LANGUAGES)
    source_language = data.get("source_language", None)
    model = _resolve_model(data.get("model"))
    
    if not phrase:
        return jsonify({"error": "Please enter a word, phrase, or question"}), 400
    
    try:
        num_examples = max(1, min(int(num_examples), len(DIFFICULTY_LABELS)))
    except (TypeError, ValueError):
        num_examples = 3

    lang_list = ", ".join(languages)
    level_labels = DIFFICULTY_LABELS[:num_examples]
    levels_list = ", ".join(level_labels)
    source_info = f'The input is in {source_language}. ' if source_language else ''

    # Example of the required response shape for the model
    format_example_lines = []
    for label in level_labels:
        format_example_lines.append(f"**{label}**")
        for lang in languages:
            format_example_lines.append(f"- {lang}: [same meaning in {lang}]")
        format_example_lines.append("")
    format_example = "\n".join(format_example_lines).strip()

    prompt = prompts.render(
        "search",
        source_info=source_info,
        phrase=phrase,
        num_examples=num_examples,
        levels_list=levels_list,
        lang_list=lang_list,
        format_example=format_example,
    )

    log_fields = {
        "model": model,
        "source_language": source_language or "auto",
        "languages": ", ".join(languages),
        "num_examples": num_examples,
        "input": phrase,
    }

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content
        append_log("SEARCH", log_fields, response_text=result)
        return jsonify({"result": result})
    except Exception as e:
        append_log("SEARCH", log_fields, error=str(e))
        return jsonify({"error": str(e)}), 500

@app.route("/explain", methods=["POST"])
def explain_sentence():
    data = request.json or {}
    sentence = (data.get("sentence") or "").strip()
    sentence_language = (data.get("sentence_language") or "").strip()
    explain_in = (data.get("explain_in") or "English").strip() or "English"
    model = _resolve_model(data.get("model"))

    if not sentence or not sentence_language:
        return jsonify({"error": "Missing sentence or language"}), 400

    prompt = prompts.render(
        "explain",
        sentence_language=sentence_language,
        explain_in=explain_in,
        sentence=sentence,
    )

    log_fields = {
        "model": model,
        "sentence_language": sentence_language,
        "explain_in": explain_in,
        "sentence": sentence,
    }

    try:
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}]
        )
        result = response.choices[0].message.content
        append_log("EXPLAIN", log_fields, response_text=result)
        return jsonify({"explanation": result})
    except Exception as e:
        append_log("EXPLAIN", log_fields, error=str(e))
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    host = os.environ.get("HOST", "127.0.0.1")
    try:
        port = int(os.environ.get("PORT", "6353"))
    except ValueError:
        port = 6353
    debug = (os.environ.get("FLASK_DEBUG", "1") or "1").strip().lower() in {"1", "true", "yes", "on"}

    print(f"Logging to {LOG_PATH}")
    print(f"Listening on http://{host}:{port}")
    with open(LOG_PATH, "a", encoding="utf-8") as f:
        f.write(f"EasyLang started at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"Log file: {LOG_PATH}\n")
        f.write(f"URL: http://{host}:{port}\n")
    app.run(debug=debug, host=host, port=port)

