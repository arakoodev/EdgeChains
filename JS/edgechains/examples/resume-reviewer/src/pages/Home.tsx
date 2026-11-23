import Layout from "../layouts/index.js";

export default function Home() {
    return (
        <Layout>
            <div className="flex h-screen bg-gray-900">
                {/* Left Side: Form and Chat */}
                <div className="w-1/2 h-full flex flex-col border-r border-gray-700 bg-gray-800 text-gray-100">
                    {/* Form Section */}
                    <div className="p-8 px-20 h-full w-full flex flex-col items-center justify-center text-center">
                        <div className="flex flex-col items-center justify-center text-center mb-12">
                            <h2 className="text-4xl font-bold text-white mb-8">
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-600 animate-gradient">
                                    Join the Race!
                                </span>
                            </h2>
                            <p className="text-lg">Upload your resume and see where you stand.</p>
                        </div>
                        <form
                            hx-target="#ranksdiv"
                            class="space-y-4"
                            id="form"
                            hx-encoding="multipart/form-data"
                            hx-post="/handleResume"
                        >
                            <input
                                id="name"
                                name="name"
                                placeholder="Enter your Name"
                                className="w-full h-12 px-4 py-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-2px] "
                                _="on change
                  if my.value is not '' and #email.value is not '' and #resume.value is not ''
                    then remove @disabled from #upload
                  else add @disabled to #upload "
                            />
                            <input
                                id="email"
                                name="email"
                                placeholder="Enter your Email"
                                className="w-full h-12 px-4 py-3 text-white rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white placeholder-gray-500 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-2px]"
                                _="on change
                  if my.value is not '' and #name.value is not '' and #resume.value is not ''
                    then remove @disabled from #upload
                  else add @disabled to #upload"
                            />
                            <input
                                id="resume"
                                type="file"
                                name="resume"
                                className="w-full h-16 px-4 py-3 rounded-md bg-gray-700 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 text-white file:bg-blue-500 file:text-white file:border-0 file:px-4 file:py-2 file:rounded-md file:hover:bg-blue-600 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-5px] hover:scale-105"
                                _="on change
                    if my.value is not '' and #name.value is not '' and #email.value is not ''
                      then remove @disabled from #upload
                    else add @disabled to #upload"
                            />
                            <button
                                className="ml-4 px-6 py-3 rounded-md bg-blue-500 hover:bg-blue-600 text-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 transition-transform transform-gpu duration-300 ease-in-out hover:translate-y-[-5px] hover:scale-105"
                                id="upload"
                                disabled
                                _="
                  on click
                    if (#name.value is '') or (#email.value is '') or (#resume.value is '')
                      then alert('Fields are empty')
                    else
                      if (#resume.value is not '')
                        trigger click on #resume
                      
                    #name.value = ''
                    #email.value = ''
                    #resume.value = ''
                      "
                            >
                                Upload
                            </button>
                        </form>
                    </div>

                    {/* Chat Section */}
                    <div
                        className="flex-grow flex flex-col rounded-lg px-4 py-6 text-center text-lg border-t border-gray-800 bg-gray-800"
                        id="chat-messages"
                    >
                        {/* Chat content will be displayed here */}
                    </div>
                </div>

                {/* Right Side: Leaderboard */}
                <div className="w-1/2 flex flex-col bg-gray-900 text-white">
                    <div className="p-6 border-b border-gray-800">
                        <h2 className="text-3xl font-bold mb-4 justify-center mx-auto w-full text-center">
                            <span className="text-white">Top Ranks</span>
                        </h2>
                    </div>
                    <div
                        id="ranksdiv"
                        className="flex flex-col overflow-y-auto px-4 py-4 h-[44rem] space-y-4"
                    ></div>
                </div>
            </div>
        </Layout>
    );
}
