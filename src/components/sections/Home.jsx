import { useState, useRef, useEffect } from 'react';

export const Home = ({ handleSubmit, result, setResult }) => {
  const [fileName, setFileName] = useState(null);
  const inputRef = useRef();
  const [techKeywords, setTechKeywords] = useState('');
  const [softKeywords, setSoftKeywords] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    console.log("Result state updated to:", result);
  }, [result]);

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

  const handleFileSelect = (e) => handleFile(e.target.files[0]);

  const handleFileDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  const handleDragOver = (e) => e.preventDefault();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!fileName || !inputRef.current.files[0]) {
      alert('Please upload a resume.');
      return;
    }

    setIsSubmitting(true);

    const formData = new FormData();
    formData.append('resume', inputRef.current.files[0]);
    formData.append('tech_keywords', techKeywords);
    formData.append('soft_keywords', softKeywords);

    try {
      const response = await fetch('http://localhost:5000/analyze', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Backend Response:', data);

      if (data.score !== undefined) {
        setResult(data.score);
        handleSubmit(data.score);
      } else {
        alert('Invalid response from server.');
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
      <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-8xl font-bold bg-gradient-to-r from-blue-500 to-green-600 bg-clip-text text-transparent mb-10 mt-10">
        ATS Scanner
      </h1>

      <form className="w-full max-w-5xl" onSubmit={onSubmit}>
        <div className="text-center">
          <p className="mb-10">
          This ATS scanner utilizes LLama to improve the precision of your resume analysis.
          While it may not function exactly like those used by large corporations,
          it can still provide a fairly accurate representation of how your resume is evaluated.
          For the best outcomes, I recommend using AI to extract both technical and soft skills from
          a job description and place them into the appropriate text fields. Use commas to separate the skills.
          </p>

          <div
            className="w-full max-w-sm mx-auto p-13 mb-6 border-2 border-dashed border-blue-500 bg-gray-900 rounded-lg text-center cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleFileDrop}
          >
            <p className="text-xl text-gray-200">Drag and drop your pdf here</p>
          </div>

          {fileName && (
            <p className="mb-4 text-sm text-gray-400 font-semibold">Filename: {fileName}</p>
          )}

          <div className="flex justify-center items-center gap-3 mb-10">
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
              onChange={handleFileSelect}
              className="hidden"
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-10 mb-10">
            <textarea
              className="w-full h-50 sm:h-96 md:h-[20rem] py-2 px-4 text-gray-50 border-2 border-blue-500 rounded resize-none"
              placeholder="Enter keywords for technical skills..."
              value={techKeywords}
              onChange={(e) => setTechKeywords(e.target.value)}
            />
            <textarea
              className="w-full h-50 sm:h-96 md:h-[20rem] py-2 px-4 text-gray-50 border-2 border-green-600 rounded resize-none"
              placeholder="Enter keywords for soft skills..."
              value={softKeywords}
              onChange={(e) => setSoftKeywords(e.target.value)}
            />
          </div>

          <button
            className="w-full max-w-[150px] mx-auto px-6 py-1 text-lg sm:text-xl md:text-2xl font-semibold rounded-full bg-gradient-to-r from-blue-500 to-green-600 hover:opacity-90 transition-all duration-200 block"
            disabled={isSubmitting}
          >
            Submit
          </button>
        </div>
      </form>

      {result != null && (
        <div className="mt-10">
          <p className="text-xl text-green-500">Analysis Complete: {result}% Match</p>
        </div>
      )}
    </section>
  );
};