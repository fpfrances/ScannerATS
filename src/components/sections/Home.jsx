import { useState, useRef } from 'react';

export const Home = ({ handleSubmit, result, setResult }) => {
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();
  const [jobDescription, setJobDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFile = (file) => {
    if (file) {
      setFileName(file.name);
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      if (inputRef.current) {
        inputRef.current.files = dataTransfer.files;
      }
    }
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const file = inputRef.current.files[0];

    if (!file || !file.name.endsWith('.pdf')) {
      alert("Please upload a valid PDF file.");
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('resume', file);
    formData.append('job_description', jobDescription); // Text area for job description

    try {
      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.technical_score !== undefined && data.soft_score !== undefined && data.final_score !== undefined)
        { const resultObj = {
          technical: data.technical_score,
          soft: data.soft_score,
          final: data.final_score,
        };
        setResult(resultObj);
        handleSubmit(resultObj);
      } else {
        alert('Invalid response from server.');
        console.error("Invalid response:", data);
      }
    } catch (err) {
      console.error('Error during submission:', err);
      alert('Something went wrong while analyzing your resume.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="min-h-screen flex flex-col items-center justify-start px-4 bg-black text-white">
      <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-500 to-green-600 bg-clip-text text-transparent mb-10 mt-10">
        ATS Scanner
      </h1>

      <form className="w-full max-w-5xl" onSubmit={onSubmit}>
        <div className="text-center">
          <p className="mb-8 mt-4">
          This resume evaluation tool uses a language model(through LlamaIndex framework and OpenAI’s GPT) to simulate how an Applicant Tracking System(ATS) might evaluate your resume.
          Although it doesn’t exactly replicate corporate ATS systems, it provides a reliable estimate of how well your resume aligns with a job descriptions
          focusing on both technical and soft skills. To achieve optimal results, upload your resume as a PDF, paste the full job and qualifications description. The tool will extract
          technical and soft skills from the job description using AI, analyze your resume for matches against those skills, and provide a score based on the matches. This gives you a clear
          view of how your resume might perform in an AI-based hiring process.
          </p>
          <p className="font-semibold">Note: The final score weights technical skills a bit more heavily than soft skills, as technical alignment is often a key factor in automated resume screenings.</p>

          <div
            className="w-full max-w-sm mx-auto p-13 mt-20 mb-6 border-2 border-dashed border-blue-500 bg-gray-900 rounded-lg text-center cursor-pointer"
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
              onChange={(e) => handleFile(e.target.files[0])}
              className="hidden"
              disabled={isSubmitting}
            />
          </div>

          <div className="mt-10 mb-10">
            <textarea
              className="w-full h-50 sm:h-96 py-2 px-4 text-gray-50 border-2 border-blue-500 rounded resize-none"
              placeholder="Paste job or qualification description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
            />
          </div>

          <button
            className="w-full max-w-[150px] mx-auto px-6 mt-2 py-1 text-lg sm:text-xl font-semibold rounded-full bg-gradient-to-r from-blue-500 to-green-600 hover:opacity-90 transition-all duration-200"
            disabled={isSubmitting}
          >
            Submit
          </button>
        </div>
      </form>

      {result && (
        <div className="mt-10 space-y-4">
          <p className="text-xl text-green-500 font-semibold">
            ✅ Analysis Complete: {result.final}% Match
          </p>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg text-black font-medium mb-2">📊 Score Breakdown</h2>
            <ul className="list-disc list-inside text-gray-700">
              <li><strong>Technical Skills Match:</strong> {result.technical}%</li>
              <li><strong>Soft Skills Match:</strong> {result.soft}%</li>
              <li className="text-blue-600">The final score balances both skill types.</li>
            </ul>
          </div>

          <div className="bg-white rounded-lg shadow p-4">
            <h2 className="text-lg text-black font-medium mb-2">🔍 Tips to Improve</h2>
            <ul className="list-disc text-left list-inside text-gray-700">
              <li>Include more relevant keywords from the job description.</li>
              <li>Use clear, action-based language and metrics.</li>
              <li>Tailor your resume per job application.</li>
            </ul>
          </div>

          <p className="text-sm text-gray-500 italic">
            This analysis is a guideline. Real ATS systems may vary.
          </p>
        </div>
      )}
    </section>
  );
};