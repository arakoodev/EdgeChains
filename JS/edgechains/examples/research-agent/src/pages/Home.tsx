import Layout from "../layout/index.js";

export default function Home() {
    return (
        <Layout>
            <div className="flex h-screen bg-gray-900">
                <div className="w-1/2 h-full flex flex-col border-r border-gray-700 bg-gray-800 text-gray-100">
                    <div className="p-8 px-20 h-full w-full flex flex-col items-center justify-center text-center">
                        <div className="flex flex-col items-center justify-center text-center mb-12">
                            <h2 className="text-4xl font-bold text-white mb-2">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-600 animate-gradient">
                                    Say Goodbye to
                                    Hours of Research
                                </span>
                            </h2>
                            <p className="text-[12px]">
                                Say Hello to Researcher Agent, your AI mate for rapid insights and comprehensive research. GPT Researcher is the leading autonomous agent that takes care of everything from accurate source gathering to organization of research results.
                            </p>
                        </div>
                        <form
                            hx-target="#output"
                            className="space-x-4 flex w-full"
                            id="form"
                            hx-encoding="multipart/form-data"
                            hx-post="/research"
                            _="on submit 
                                set @disabled of #send to true
                                remove .hidden from #output
                                then set @disabled of #send to false
                                set #query's value to ''
                                "
                        >
                            <input
                                id="query"
                                name="query"
                                placeholder="Ask a question"
                                className="w-full h-12 px-4 py-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-2px]"
                            />

                            <button
                                className="ml-4 px-6 py-3 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-5px] hover:scale-105 disabled:opacity-25"
                                id="send"
                                type="submit"
                            >
                                Send
                            </button>
                        </form>
                    </div>
                </div>

                <div className="w-1/2 flex flex-col bg-gray-900 text-white">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="text-3xl font-bold mb-4 justify-center mx-auto w-full text-center">
                            <span className="text-white">Research About your prompt</span>
                        </h2>
                    </div>
                    <div
                        id="output"
                        className="flex hidden flex-col overflow-y-auto px-4 py-4 h-[44rem] space-y-4 text-sm"
                    >
                        <div className='flex justify-center items-center'>
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-20 h-20 mt-20" viewBox="0 0 24 24"><circle cx="4" cy="12" r="3" fill="currentColor"><animate id="svgSpinners3DotsScale0" attributeName="r" begin="0;svgSpinners3DotsScale1.end-0.25s" dur="0.75s" values="3;.2;3" /></circle><circle cx="12" cy="12" r="3" fill="currentColor"><animate attributeName="r" begin="svgSpinners3DotsScale0.end-0.6s" dur="0.75s" values="3;.2;3" /></circle><circle cx="20" cy="12" r="3" fill="currentColor"><animate id="svgSpinners3DotsScale1" attributeName="r" begin="svgSpinners3DotsScale0.end-0.45s" dur="0.75s" values="3;.2;3" /></circle></svg>
                        </div>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
