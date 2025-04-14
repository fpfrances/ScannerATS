import os
import re
from dotenv import load_dotenv
from llama_index.llms.openai import OpenAI
from llama_index.core import VectorStoreIndex, Document
from PyPDF2 import PdfReader
from flask import Flask, request, jsonify
from flask_cors import CORS

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))
API_KEY = os.getenv("OPENAI_API_KEY")

app = Flask(__name__)
CORS(app)

def extract_text_from_pdf(pdf_file):
    try:
        reader = PdfReader(pdf_file)
        text = "".join(page.extract_text() or "" for page in reader.pages)
        return text
    except Exception as e:
        print("Error extracting text:", e)
        return ""

def build_index(keywords):
    return VectorStoreIndex.from_documents([Document(text=kw) for kw in keywords])

def normalize_score(raw_score):
    try:
        match = re.search(r'\d+(\.\d+)?', raw_score)
        if match:
            value = float(match.group())
            return f"{min(max(value, 0), 100):.0f}"
    except Exception as e:
        print("Score normalization error:", e)
    return "0"

def calculate_score_with_index(resume_text, index, role_data):
    resume_text = resume_text.lower()
    tech_keywords = [kw.lower() for kw in role_data.get("technical_skills", [])]
    soft_keywords = [kw.lower() for kw in role_data.get("soft_skills", [])]

    cleaned_resume = re.sub(r'[^a-zA-Z0-9\s]', '', resume_text)
    resume_words = set(cleaned_resume.split())

    query = f"""
    Resume: {resume_text[:4000]}

    Analyze this resume and calculate match percentage (0-100) using:
    - TECHNICAL SKILLS ({', '.join(tech_keywords)})
    - SOFT SKILLS ({', '.join(soft_keywords)})

    Scoring Rules:
    1. Technical matches (65%): out of {len(tech_keywords)}
    2. Soft skills matches (35%): out of {len(soft_keywords)}

    Output the results in this format only:
    TECH: [percentage]%
    SOFT: [percentage]%
    FINAL: [score]
    """

    try:
        llm = OpenAI(model="gpt-3.5-turbo")
        query_engine = index.as_query_engine(llm=llm)
        response = query_engine.query(query)
        raw = response.response.strip()
        print("LLM Raw Response:", raw)

        # Parse values
        tech_match = re.search(r'TECH:\s*(\d+)', raw)
        soft_match = re.search(r'SOFT:\s*(\d+)', raw)
        final_match = re.search(r'FINAL:\s*(\d+)', raw)

        return {
            "technical": int(tech_match.group(1)) if tech_match else 0,
            "soft": int(soft_match.group(1)) if soft_match else 0,
            "final": int(final_match.group(1)) if final_match else 0
        }
    except Exception as e:
        print("LLM error:", e)
        return {
            "technical": 0,
            "soft": 0,
            "final": 0
        }
    
def extract_scores(raw_response):
    try:
        tech_match = re.search(r'TECH:\s*(\d+)', raw_response)
        soft_match = re.search(r'SOFT:\s*(\d+)', raw_response)
        final_match = re.search(r'FINAL:\s*(\d+)', raw_response)

        tech_score = int(tech_match.group(1)) if tech_match else 0
        soft_score = int(soft_match.group(1)) if soft_match else 0
        final_score = int(final_match.group(1)) if final_match else 0

        return {
            "technical": tech_score,
            "soft": soft_score,
            "final": final_score
        }
    except Exception as e:
        print("Score parsing error:", e)
        return {
            "technical": 0,
            "soft": 0,
            "final": 0
        }

# Testpoint health
@app.route('/health')
def health_check():
    return "OK", 200

@app.route('/analyze', methods=['POST'])
def analyze_resume():
    resume_file = request.files.get('resume')
    tech_keywords = request.form.get('tech_keywords')
    soft_keywords = request.form.get('soft_keywords')

    if not (resume_file and tech_keywords and soft_keywords):
        return jsonify({'error': 'Missing file or keywords'}), 400

    tech_list = [kw.strip() for kw in re.split(r'[,\n]', tech_keywords) if kw.strip()]
    soft_list = [kw.strip() for kw in re.split(r'[,\n]', soft_keywords) if kw.strip()]

    role_data = {
        "technical_skills": tech_list,
        "soft_skills": soft_list
    }

    index = build_index(tech_list + soft_list)
    resume_text = extract_text_from_pdf(resume_file)
    score_data = calculate_score_with_index(resume_text, index, role_data)
    
    print("Backend response:", score_data)

    return jsonify({
    "technical": score_data["technical"],
    "soft": score_data["soft"],
    "score": score_data["final"]
})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # use 5000 as fallback for local dev
    app.run(host="0.0.0.0", port=port, debug=True)