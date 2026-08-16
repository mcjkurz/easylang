# EasyLang

Learn words, phrases, and answers across multiple languages.

<p>
  <img src="docs/home.png" alt="EasyLang home — enter a phrase, pick languages, and learn" width="520" />
</p>
<p>
  <img src="docs/results.png" alt="EasyLang results — same sentence across languages by difficulty" width="520" />
</p>

## Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `.env` with any OpenAI-compatible endpoint and models:

```
API_KEY=your_api_key_here
API_BASE_URL=https://api.openai.com/v1
API_MODELS=GPT-5.4-Nano,GPT-5.4-Mini,Claude-Sonnet-5,GPT-5.6-Sol
API_DEFAULT_MODEL=GPT-5.4-Mini
HOST=127.0.0.1
PORT=6353
```

`API_MODELS` is a comma-separated list shown in Settings. `API_DEFAULT_MODEL` must be one of those IDs.

Examples for `API_BASE_URL`:
- OpenAI: `https://api.openai.com/v1`
- Poe: `https://api.poe.com/v1`
- Local proxy: `http://localhost:8000/v1`

## Run

```bash
./start.sh
```

Open the URL printed by `start.sh` (default http://127.0.0.1:6353).

Logs for each run are written under `logs/`.

## Notes

- Target languages, model choice, explanations cache, and saved sentences are stored in the browser (`localStorage`).
- Never commit `.env` — it is gitignored.
