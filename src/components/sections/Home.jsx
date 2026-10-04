import { useState, useRef, useEffect } from 'react';
import { FaLinkedin } from 'react-icons/fa';

// Not a secret, but keeping it in one place (or in .env as VITE_API_URL)
// makes it easy to switch hosts.
const API_URL = import.meta.env.VITE_API_URL || 'https://ats-scanner-9akh.onrender.com';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // same 5 MB limit as the backend
const REQUEST_TIMEOUT_MS = 90_000; // cold starts on free hosting can be slow

const listOrNone = (items) =>
  Array.isArray(items) && items.length > 0 ? items.join(', ') : 'None found';

const validateFile = (file) => {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return 'Please upload a PDF file.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'The PDF is too large. The maximum size is 5 MB.';
  }
  return null;
};

export const Home = ({ handleSubmit, result, setResult }) => {
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Wake the backend up while the visitor is still reading the page.
  useEffect(() => {
    fetch(`${API_URL}/health`).catch(() => {});
  }, []);

  const handleFile = (file) => {
    if (!file) return;

    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      setFileName(null);
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    setError('');
    setFileName(file.name);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    if (inputRef.current) {
      inputRef.current.files = dataTransfer.files;
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const file = inputRef.current?.files[0];
    if (!file) {
      setError('Please choose a PDF file first.');
      return;
    }
    const problem = validateFile(file);
    if (problem) {
      setError(problem);
      return;
    }
    if (!jobDescription.trim()) {
      setError('Please paste the job description.');
      return;
    }

    setIsSubmitting(true);
    setResult(null);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('job_description', jobDescription);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        // The backend sends a readable message in `error`.
        setError(data.error || `The server returned an error (${response.status}).`);
        return;
      }

      if (
        data.technical_score === undefined ||
        data.soft_score === undefined ||
        data.final_score === undefined
      ) {
        setError('The server sent an unexpected response. Please try again.');
        console.error('Invalid response:', data);
        return;
      }

      const resultObj = {
        techMatch: data.matched_technical_skills,
        softMatch: data.matched_soft_skills,
        technical: data.technical_score,
        soft: data.soft_score,
        final: data.final_score,
      };
      setResult(resultObj);
      handleSubmit(resultObj);
    } catch (err) {
      console.error('Error during submission:', err);
      setError(
        err.name === 'AbortError'
          ? 'The request took too long. The server may be waking up, so please try again in a minute.'
          : 'Something went wrong while analyzing your resume. Please try again.'
      );
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen overflow-y-scroll no-scrollbar flex flex-col items-center justify-start px-4 bg-black text-white">
      <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-500 to-green-600 bg-clip-text text-transparent mb-10 mt-10">
        AI-Powered ATS Resume Scanner
      </h1>

      <form className="w-full max-w-5xl" onSubmit={onSubmit}>
        <div className="text-center">
          <p className="mb-8 mt-4">
            This prototype uses a language model (OpenAI's GPT, through the LlamaIndex framework)
            to estimate how well your resume matches a job description. The AI extracts the
            technical and soft skills from the job posting, then the tool checks your resume for
            those keywords and gives a weighted score. It is a rough, keyword-based estimate and
            does not replicate corporate ATS systems. For best results, upload your resume as a
            PDF and paste the full job and qualifications description.
          </p>

          <div
            className="w-full max-w-sm mx-auto p-13 mt-20 mb-6 border-2 border-dashed border-blue-500 bg-gray-900 rounded-lg text-center cursor-pointer"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFile(e.dataTransfer.files[0]);
            }}
          >
            <p className="text-xl text-gray-200">Drag and drop your PDF here</p>
          </div>

          {fileName && (
            <p className="mb-4 mt-10 text-md text-gray-400 font-semibold">Filename: {fileName} ✅</p>
          )}

          <div className="flex justify-center items-center gap-3 mb-10 mt-10">
            <label
              htmlFor="fileInput"
              className="cursor-pointer inline-block px-4 py-2 text-sm font-semibold text-white rounded-full bg-gradient-to-r from-blue-500 to-green-600 hover:opacity-90"
            >
              Choose File
            </label>
            <input
              ref={inputRef}
              id="fileInput"
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
              disabled={isSubmitting}
            />
          </div>

          <div className="mt-10 mb-10">
            <textarea
              className="w-full h-50 sm:h-96 py-2 px-4 text-gray-50 border-2 border-blue-500 rounded-2xl resize-none transition
                        focus:outline-none hover:shadow-[0_0_40px_rgba(234,179,8,0.4)]"
              placeholder="Paste job or qualification description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              disabled={isSubmitting}
              maxLength={10000}
              aria-label="Job description"
            />
          </div>

          {error && (
            <p role="alert" className="mb-4 text-red-400 font-semibold">
              {error}
            </p>
          )}

          <button
            type="submit"
            className="w-full max-w-[180px] mx-auto px-6 mt-2 py-1 text-lg sm:text-xl font-semibold rounded-full bg-gradient-to-r from-blue-500 to-green-600 hover:opacity-90 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Analyzing...' : 'Submit'}
          </button>

          {isSubmitting && (
            <p className="mt-4 text-sm text-gray-400" aria-live="polite">
              Analyzing your resume. The first scan can take up to a minute while the server wakes up.
            </p>
          )}
        </div>
      </form>

      {result && (
        <div className="mt-10 space-y-4">
          <p className="text-xl text-green-500 font-semibold">
            ✅ Analysis Complete: {result.final}% Match
          </p>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg text-black font-medium mb-2">📊 Score Breakdown</h2>
            <ul className="list-disc text-center list-inside text-gray-700">
              <li><strong>Technical Skills Match:</strong> {result.technical}%</li>
              <li><strong>Matched Technical Skills:</strong> {listOrNone(result.techMatch)}</li>
              <br />
              <li><strong>Soft Skills Match:</strong> {result.soft}%</li>
              <li><strong>Matched Soft Skills:</strong> {listOrNone(result.softMatch)}</li>
              <br />
              <li className="text-blue-600">
                Since technical alignment is frequently a crucial component in automated resume
                screenings, technical skills are given a slightly higher weight in the final score
                than soft skills.
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg text-black font-medium mb-2">🔍 Tips to Improve</h2>
            <ul className="list-disc text-center list-inside text-gray-700">
              <li>Include more relevant keywords from the job description.</li>
              <li>Use clear, action-based language and metrics.</li>
              <li>Tailor your resume per job application.</li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 italic">
            This analysis is a rough guideline based on keyword matching. Real ATS systems may vary.
          </p>
        </div>
      )}

      <div className="mt-25 translate-y-10 flex justify-center items-center gap-5">
        <a
          href="https://www.linkedin.com/in/filipefrances/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="LinkedIn profile"
        >
          <FaLinkedin className="text-3xl text-blue-500 hover:text-blue-600 transition" />
        </a>
      </div>
    </section>
  );
};
