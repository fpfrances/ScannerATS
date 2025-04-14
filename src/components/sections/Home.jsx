import { useState, useRef } from 'react';

export const Home = ({ handleSubmit, result, setResult }) => {
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();
  const [techKeywords, setTechKeywords] = useState('');
  const [softKeywords, setSoftKeywords] = useState('');
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
    formData.append('tech_keywords', techKeywords);
    formData.append('soft_keywords', softKeywords);

    try {
      const response = await fetch('https://ats-scanner-9akh.onrender.com/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok && data.technical !== undefined && data.soft !== undefined && data.score !== undefined) {
        setResult({
          technical: data.technical,
          soft: data.soft,
          final: data.score
        });
        handleSubmit({
          technical: data.technical,
          soft: data.soft,
          final: data.score
        });
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
        <p className="mb-10 mt-10">
          This resume evaluation tool uses a language model(through the LlamaIndex framework and OpenAI’s GPT) to simulate how an ATS might evaluate your resume.
          Although it doesn’t exactly replicate corporate ATS systems, it offers a reliable estimate of how well your resume aligns with a job description
          in terms of both technical and soft skills. To achieve optimal results, I recommend using AI to extract both technical and soft skills from a job/qualification description,
          paste the essential technical and soft skills into the designated fields. Each skill should be input either individually, separated by a comma, or listed on a new line.
          </p>

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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 mt-20 mb-10">
            <textarea
              className="w-full h-50 sm:h-96 py-2 px-4 text-gray-50 border-2 border-blue-500 rounded resize-none"
              placeholder="Enter technical skills (comma or newline)..."
              value={techKeywords}
              onChange={(e) => setTechKeywords(e.target.value)}
            />
            <textarea
              className="w-full h-50 sm:h-96 py-2 px-4 text-gray-50 border-2 border-green-600 rounded resize-none"
              placeholder="Enter soft skills (comma or newline)..."
              value={softKeywords}
              onChange={(e) => setSoftKeywords(e.target.value)}
            />
          </div>

          <button
            className="w-full max-w-[150px] mx-auto px-6 mt-12 py-1 text-lg sm:text-xl font-semibold rounded-full bg-gradient-to-r from-blue-500 to-green-600 hover:opacity-90 transition-all duration-200"
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