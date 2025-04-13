import { useEffect, useState } from "react"

export const AnalyzingScreen = ({ onComplete }) => {
    const [text, setText] = useState("")
    const fullText = "Analyzing your resume..."

    useEffect(() => {
        let index = 0;
        const interval = setInterval(() => {
            setText(fullText.substring(0, index))
            index++

            if (index > fullText.length) {
                clearInterval(interval)
                setTimeout(() => {
                    onComplete()
                }, 1000)
            }
        }, 100)

        return () => clearInterval(interval)
    }, [onComplete])

    return (
        <div className="fixed inset-0 z-50 bg-black text-gray-100 flex flex-col items-center justify-center px-4">
            <div className="mb-4 text-2xl sm:text-3xl md:text-4xl font-mono font-bold text-center">
                {text} <span className="animate-blink ml-1">|</span>
            </div>
            <div className="w-full max-w-xs sm:max-w-sm md:max-w-md h-[2px] bg-gray-800 rounded relative overflow-hidden">
                <div className="w-[40%] h-full bg-blue-500 shadow-[0_0_20px_#3b82f6] animate-bar"></div>
            </div>
        </div>
    )
}