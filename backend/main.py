import os
import re
from dotenv import load_dotenv
from config import API_KEY
from llama_index.llms.openai import OpenAI
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
        return ""

def extract_skills_from_job_description(job_description):
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
{{
  "technical_skills": [...],
  "soft_skills": [...],
}} 
Only return the JSON, nothing else.
"""

    try:
        llm = OpenAI(model="gpt-3.5-turbo",api_key=API_KEY,temperature=0)
        response = llm.complete(prompt=prompt, max_tokens=300)
        skills = eval(response.text.strip())  # Evaluating the response as a Python dictionary
        technical_skills = skills.get("technical_skills", [])
        soft_skills = skills.get("soft_skills", [])
        
        return technical_skills, soft_skills
    except Exception as e:
        return [], []

def normalize(text):
    # Lowercase and replace hyphens with spaces
    text = text.lower().replace('-', ' ')
    # Keep alphanumeric characters and '+' (for C++) and spaces
    text = re.sub(r'[^\w\s\+]', '', text)
    # Replace multiple spaces with one
    return re.sub(r'\s+', ' ', text).strip()

def calculate_individual_scores(resume_text, tech_keywords, soft_keywords):
    resume_clean = normalize(resume_text)

    def match_keywords(resume, keywords):
        matches = []
        for kw in keywords:
            kw_clean = normalize(kw)
            # Look for full match using simple string check
            if kw_clean in resume:
                matches.append(kw)
        return matches

    tech_matches = match_keywords(resume_clean, tech_keywords)
    soft_matches = match_keywords(resume_clean, soft_keywords)

    tech_score = len(tech_matches) / len(tech_keywords) * 100 if tech_keywords else 0
    soft_score = len(soft_matches) / len(soft_keywords) * 100 if soft_keywords else 0

    final_score = tech_score * 0.65 + soft_score * 0.35

    return round(tech_score), round(soft_score), round(final_score), tech_matches, soft_matches

@app.route('/')
def home():
    return "Welcome to the Resume Analyzer!"

# Testpoint health
@app.route('/health')
def health_check():
    return "OK", 200

@app.route('/analyze', methods=['POST'])
def analyze_resume():
    resume_file = request.files.get('resume')
    job_text = request.form.get('job_description')

    if not job_text or not resume_file:
        return jsonify({'error': 'Missing resume or job description'}), 400

    tech_keywords, soft_keywords = extract_skills_from_job_description(job_text)
    resume_text = extract_text_from_pdf(resume_file)

    # Print extracted technical and soft skills for backend testing
    print("Technical Skills:")
    for skill in tech_keywords:
        print(f"- {skill}")

    print("\nSoft Skills:")
    for skill in soft_keywords:
        print(f"- {skill}")

    tech_score, soft_score, final_score, matched_tech, matched_soft = calculate_individual_scores(
        resume_text, tech_keywords, soft_keywords
    )
    
    # Print matched technical and soft skills (comma-separated) for backend testing
    print("\nMatched Technical Skills in Resume:")
    print(", ".join(matched_tech))

    print("\nMatched Soft Skills in Resume:")
    print(", ".join(matched_soft))

    return jsonify({
        "technical_score": tech_score,
        "soft_score": soft_score,
        "final_score": final_score,
        "extracted_technical_skills": tech_keywords,
        "extracted_soft_skills": soft_keywords,
        "matched_technical_skills": matched_tech,
        "matched_soft_skills": matched_soft
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))  # use 5000 as fallback for local dev
    app.run(host="0.0.0.0", port=port, debug=True)