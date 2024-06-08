
async function fetchResume() {
    const showRanks = document.getElementById("ranksdiv");
    const response = await fetch("http://localhost:3000/get-resume")
    const { data } = await response.json()
    const parsedResumeDetails = data
    const newResumeArr = []
    for (let index = 0; index < parsedResumeDetails.length; index++) {
        const element = JSON.parse(parsedResumeDetails[index].resumeDetails);
        const totalPoints = element.fullTimeExperienceInMonthsPoints + element.internshipExperienceInMonthsPoints + element.projectsPoints + element.achievementsPoints + element.skillsPoints

        const newResumeObj = {
            ...parsedResumeDetails[index],
            totalPoints
        };
        newResumeArr.push(newResumeObj);
    }


    const sortedArr = newResumeArr.sort((a, b) => b.totalPoints - a.totalPoints);
    for (let i = 0; i < sortedArr.length; i++) {
        const element = sortedArr[i];
        console.log(element)
        showRanks.innerHTML += ` <div class="border m-4 rounded-xl h-20 flex text-white px-4 items-center">
                                <div class="rounded-full bg-black text-white w-14 h-14 flex justify-center items-center">
                                    <span class="text-2xl">${element.name[0]}</span>
                                </div>
                                <div class="flex justify-between w-full px-4">
                                    <div class="flex flex-col">
                                        <span>Name</span>
                                        <span>${element.name}</span>
                                    </div>
                                    <div class="flex flex-col">
                                        <span>Points</span>
                                        <span>${sortedArr[i].totalPoints}</span>
                                    </div>
                                    <div class="flex flex-col">
                                        <span>Rank</span>
                                        <span>${i + 1}/${parsedResumeDetails.length}</span>
                                    </div>
                                </div>
                            </div>`
    }
}

fetchResume();
let loading = false;
async function handleResume() {
    const resumeInput = document.getElementById('resumeInput');
    const name = document.getElementById('name');
    const email = document.getElementById('email');

    if (resumeInput.files.length === 0 || name.value === '' || email.value === '') {
        alert("Please fill all the fields");
        return;
    }

    const chatMessages = document.getElementById('chat-messages');

    const file = resumeInput.files[0];
    if (file) {
        chatMessages.innerHTML = 'Uploading...';

        var formData = new FormData();
        formData.append("file", file);
        formData.append("name", name.value);
        formData.append("email", email.value);

        try {
            const response = await fetch('http://localhost:3000/upload-resume', {
                method: 'POST',
                body: formData,
            })
            window.location.reload();
            const data = await response.json()

        } catch (error) {
            console.error('Error:', error);
            chatMessages.innerHTML = 'An error occurred. Please try again.';
        }



    } else {
        chatMessages.innerHTML = 'No file selected.';
    }
}

