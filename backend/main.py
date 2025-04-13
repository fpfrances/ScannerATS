import os
from dotenv import load_dotenv
from config import API_KEY
from llama_index.llms.openai import OpenAI
from llama_index.core import VectorStoreIndex, Document
from PyPDF2 import PdfReader
from flask import Flask, request, jsonify
from flask_cors import CORS

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

# Set OpenAI API Key
API_KEY = os.getenv("OPENAI_API_KEY")

# Flask setup
app = Flask(__name__)
CORS(app)  # Enable CORS to allow frontend requests

# Extract text from PDF
def extract_text_from_pdf(pdf_file):
    try:
        reader = PdfReader(pdf_file)
        return "".join(page.extract_text() or "" for page in reader.pages)
    except Exception:
        return ""

# Build LlamaIndex
def build_index(keywords):
    documents = [Document(text=kw) for kw in keywords]
    return VectorStoreIndex.from_documents(documents)

# Resume scoring
def calculate_score_with_index(resume_text, index, role_data):
    tech_keywords = [kw.strip().lower() for kw in role_data.get("technical_skills", [])]
    soft_keywords = [kw.strip().lower() for kw in role_data.get("soft_skills", [])]

    query = f"""Analyze this resume and calculate match percentage (0-100) using:
    - TECHNICAL SKILLS ({', '.join(tech_keywords)})
    - SOFT SKILLS ({', '.join(soft_keywords)})

    Scoring Rules:
    1. Technical matches (65%): {len([t for t in tech_keywords if t in resume_text.lower()])}/{len(tech_keywords)} found
    2. Soft skills matches (35%): {len([s for s in soft_keywords if s in resume_text.lower()])}/{len(soft_keywords)} found

    Final Score = (Technical% * 0.65) + (Soft% * 0.35)
    Return ONLY the number without % symbol.
    """

    try:
        query_engine = index.as_query_engine()
        response = query_engine.query(query)
        return normalize_score(response.response.strip())
    except Exception:
        return "0"

def normalize_score(raw_score):
    try:
        score = float(raw_score.replace("%", ""))
        return f"{min(max(score, 0), 100):.0f}"
    except:
        return "0"

# Flask route to handle file + keyword upload
@app.route('/analyze', methods=['POST'])
def analyze_resume():
    resume_file = request.files.get('resume')
    tech_keywords = request.form.get('tech_keywords')
    soft_keywords = request.form.get('soft_keywords')

    if not tech_keywords or not soft_keywords:
        return jsonify({'error': 'Missing keywords'}), 400

    tech_list = [kw.strip() for kw in tech_keywords.splitlines() if kw.strip()]
    soft_list = [kw.strip() for kw in soft_keywords.splitlines() if kw.strip()]

    role_data = {
        "technical_skills": tech_list,
        "soft_skills": soft_list
    }

    index = build_index(tech_list + soft_list)
    resume_text = extract_text_from_pdf(resume_file)
    score = calculate_score_with_index(resume_text, index, role_data)
    
    return jsonify({"score": score})

# Run the app
if __name__ == "__main__":
    app.run(debug=True, port=5000)