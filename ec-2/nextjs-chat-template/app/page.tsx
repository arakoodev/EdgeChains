import { ask } from "./actions/ask";

export default function Page() {
  async function submit(formData: FormData) {
    "use server";
    const question = String(formData.get("question") || "");
    return await ask(question);
  }

  return (
    <main style={{ padding: "2rem" }}>
      <form action={submit}>
        <input type="text" name="question" placeholder="Ask a question" />
        <button type="submit">Ask</button>
      </form>
    </main>
  );
}
