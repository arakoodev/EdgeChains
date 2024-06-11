export default function RankCard({rank,parsedResumeDetails,i}:any) {
  const element = rank
  
    return (
      <div className="w-full bg-gray-900 h-[16rem] rounded-2xl shadow-lg text-white">
        <div className="px-2 py-2 rounded-t-2xl space-y-4">
          {/* Data Rows with Column Headers on Each Row */}
            <div className="bg-gray-800 rounded-xl"> 
              <div className="grid grid-cols-3 gap-4 px-4 py-2 text-gray-300 uppercase text-sm font-semibold">
                <div className="flex items-center justify-start">Name</div>
                <div className="text-center">Points</div>
                <div className="flex justify-end mr-10">Rank</div>
              </div>

              <div className="flex items-center bg-gray-800  py-2 px-4 hover:bg-gray-600 transition duration-150">
              <div className="w-20 h-12 flex items-center text-white justify-center rounded-full bg-gradient-to-br from-purple-400 to-blue-700 text-black text-lg font-bold mr-4">
              {element.name[0]}
              </div>
              <div className="flex-grow">
                <p className="font-medium">{element.name}</p>
              </div>
              <div className="text-lg font-medium w-full text-center mr-10">
              {element.totalPoints}
              </div>
              <div className="text-lg font-medium flex justify-end mr-10">{i + 1}/{parsedResumeDetails.length}</div>
            </div>
            </div>

        </div>
      </div>
    );
  }