import Layout from "../layout/index.js";

export default function Home() {
    return (
        <>
            <Layout>
                <div className="flex h-full justify-center items-center">
                    <div className="bg-white p-5 rounded-md shadow-md w-[40rem]">
                        <form
                            hx-post="/translate"
                            hx-encoding="multipart/form-data"
                            hx-target="#translatedText"
                        >
                            <label
                                htmlFor="language"
                                className="block text-sm font-medium text-gray-700"
                            >
                                Language
                            </label>
                            <select
                                className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                name="language"
                                hx-get="/models"
                                hx-indicator=".htmx-indicator"
                            >
                                <option value="Spanish">Spanish</option>
                                <option value="French">French</option>
                                <option value="German">German</option>
                            </select>

                            <label
                                htmlFor="text"
                                className="block text-sm font-medium text-gray-700 mt-5"
                            >
                                Text to Translate
                            </label>
                            <textarea
                                id="textarea"
                                className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                name="text"
                                rows={4}
                                placeholder="Search..."
                            ></textarea>
                            <button
                                className="w-full bg-blue-500 text-white py-2 px-4 mt-5 rounded-md hover:bg-blue-700"
                                _="on click if #textarea.value == '' call alert('fill all the fields') "
                                type="submit"
                            >
                                Submit
                            </button>
                        </form>

                        <div
                            id="translatedText"
                            className="mt-4 p-2 bg-gray-100 border border-gray-300 rounded-md"
                        ></div>
                    </div>
                </div>
            </Layout>
        </>
    );
}
