import json
import logging
import os
import re

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from llama_index.llms.openai import OpenAI
from PyPDF2 import PdfReader

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

API_KEY = os.getenv("OPENAI_API_KEY")

# Only these sites may call the API from a browser. Add your own domains here,
# or set ALLOWED_ORIGINS in Vercel as a comma-separated list.
DEFAULT_ORIGINS = [
    "https://fpfrances.github.io",
    "http://localhost:5173",  # Vite dev server
]
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", ",".join(DEFAULT_ORIGINS)).split(",")
    if o.strip()
]

MAX_JOB_TEXT_CHARS = 10_000
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = MAX_UPLOAD_BYTES
CORS(app, origins=ALLOWED_ORIGINS)
logging.basicConfig(level=logging.INFO)

# Create the client once so warm requests don't rebuild it.
llm = OpenAI(model="gpt-3.5-turbo", api_key=API_KEY, temperature=0) if API_KEY else None


class SkillExtractionError(Exception):
    """Raised when the LLM call fails or returns something unusable."""


def extract_text_from_pdf(pdf_file):
    try:
        reader = PdfReader(pdf_file)
        return "".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        app.logger.exception("Could not read PDF")
        return ""


def parse_skills_json(raw):
    """Safely turn the model's reply into a dict (no eval)."""
    text = raw.strip()
    # Remove ```json fences if the model added them.
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    # Keep only the outermost {...} in case of extra words around it.
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise SkillExtractionError("Model did not return JSON")
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError as exc:
        raise SkillExtractionError("Model returned invalid JSON") from exc
    if not isinstance(data, dict):
        raise SkillExtractionError("Model JSON was not an object")
    return data


def clean_skill_list(items):
    """Keep non-empty strings, remove duplicates, preserve order."""
    seen, result = set(), []
    if not isinstance(items, list):
        return result
    for item in items:
        if not isinstance(item, str):
            continue
        skill = item.strip()
        key = skill.lower()
        if skill and key not in seen:
            seen.add(key)
            result.append(skill)
    return result


def extract_skills_from_job_description(job_description):
    if llm is None:
        raise SkillExtractionError("OpenAI API key is not configured on the server")

    prompt = f"""
You are an AI assistant helping extract information from job postings.

Given this job description:
\"\"\"
{job_description}
\"\"\"

Return a JSON object with two lists:
- "technical_skills": technical/hard skills or tools (e.g., Python, databases, Docker)
- "soft_skills": soft/interpersonal skills (e.g., communication, problem-solving)

Format:
{{"technical_skills": ["..."], "soft_skills": ["..."]}}

Only return the JSON, nothing else.
"""

    try:
        response = llm.complete(prompt=prompt, max_tokens=500)
    except Exception as exc:
        app.logger.exception("OpenAI request failed")
        raise SkillExtractionError("The AI service request failed") from exc

    data = parse_skills_json(response.text)
    technical = clean_skill_list(data.get("technical_skills", []))
    soft = clean_skill_list(data.get("soft_skills", []))
    if not technical and not soft:
        raise SkillExtractionError("No skills were found in the job description")
    return technical, soft


def normalize(text):
    # Lowercase and replace hyphens with spaces
    text = text.lower().replace("-", " ")
    # Keep alphanumeric characters, '+' (for C++) and spaces
    text = re.sub(r"[^\w\s\+]", "", text)
    # Collapse repeated whitespace
    return re.sub(r"\s+", " ", text).strip()


def keyword_in_text(keyword_clean, text_clean):
    """Whole-word match, so 'java' does not match 'javascript'."""
    if not keyword_clean:
        return False
    end = r"(?!\w)" if keyword_clean.endswith("+") else r"(?![\w+])"
    pattern = r"(?<!\w)" + re.escape(keyword_clean) + end
    return re.search(pattern, text_clean) is not None


def calculate_individual_scores(resume_text, tech_keywords, soft_keywords):
    resume_clean = normalize(resume_text)

    def match_keywords(keywords):
        return [kw for kw in keywords if keyword_in_text(normalize(kw), resume_clean)]

    tech_matches = match_keywords(tech_keywords)
    soft_matches = match_keywords(soft_keywords)

    tech_score = len(tech_matches) / len(tech_keywords) * 100 if tech_keywords else 0
    soft_score = len(soft_matches) / len(soft_keywords) * 100 if soft_keywords else 0

    final_score = tech_score * 0.65 + soft_score * 0.35

    return (
        round(tech_score),
        round(soft_score),
        round(final_score),
        tech_matches,
        soft_matches,
    )


@app.route("/")
def home():
    return "Welcome to the Resume Analyzer!"


@app.route("/health")
def health_check():
    return "OK", 200


@app.route("/analyze", methods=["POST"])
def analyze_resume():
    resume_file = request.files.get("resume")
    job_text = (request.form.get("job_description") or "").strip()

    if not job_text or not resume_file:
        return jsonify({"error": "Missing resume or job description"}), 400
    if len(job_text) > MAX_JOB_TEXT_CHARS:
        return jsonify({"error": "Job description is too long"}), 400

    resume_text = extract_text_from_pdf(resume_file)
    if not resume_text.strip():
        return (
            jsonify(
                {
                    "error": "Could not read text from the PDF. "
                    "Scanned (image-only) PDFs are not supported."
                }
            ),
            422,
        )

    try:
        tech_keywords, soft_keywords = extract_skills_from_job_description(job_text)
    except SkillExtractionError as exc:
        return jsonify({"error": str(exc)}), 502

    tech_score, soft_score, final_score, matched_tech, matched_soft = (
        calculate_individual_scores(resume_text, tech_keywords, soft_keywords)
    )

    app.logger.info(
        "Scored resume: tech=%s soft=%s final=%s", tech_score, soft_score, final_score
    )

    return jsonify(
        {
            "technical_score": tech_score,
            "soft_score": soft_score,
            "final_score": final_score,
            "extracted_technical_skills": tech_keywords,
            "extracted_soft_skills": soft_keywords,
            "matched_technical_skills": matched_tech,
            "matched_soft_skills": matched_soft,
        }
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # 5000 as fallback for local dev
    debug = os.getenv("FLASK_DEBUG") == "1"  # off unless you opt in locally
    app.run(host="127.0.0.1" if debug else "0.0.0.0", port=port, debug=debug)