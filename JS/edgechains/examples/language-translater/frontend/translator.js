document.getElementById("translateButton").addEventListener("click", async () => {
    const language = document.getElementById("language").value;
    const text = document.getElementById("text").value;
    const translatedTextDiv = document.getElementById("translatedText");

    const endpoint = "http://localhost:3000/translate";

    try {
        const response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                language: language,
                text: text,
            }),
        });

        if (response.ok) {
            const data = await response.json();
            translatedTextDiv.textContent = data;
        } else {
            translatedTextDiv.textContent = "Error: Unable to translate text.";
        }
    } catch (error) {
        translatedTextDiv.textContent = "Error: Unable to connect to the translation service.";
    }
});
