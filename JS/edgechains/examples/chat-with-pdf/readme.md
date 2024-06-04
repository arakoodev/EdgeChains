---

# Setup
1. Clone the repo into a public GitHub repository (or fork [https://github.com/arakoodev/EdgeChains/fork](https://github.com/arakoodev/EdgeChains/fork)).

``` 
  git clone https://github.com/arakoodev/EdgeChains/
```

2. Go to the project folder
```
  cd EdgeChains
```

# Run the ChatWithPdf example

This section provides instructions for developers on how to utilize the chat with PDF feature. By following these steps, you can integrate the functionality seamlessly into your projects.

---

1. Go to the ChatWithPdfExample

```
  cd JS/edgechains/examples/chat-with-pdf/
```

2. Install packages with npm

```
  npm install
```

3. Setup you secrets in `secrets.jsonnet`

```
  local SUPABASE_API_KEY = "your supabase api key here";


  local OPENAI_API_KEY = "your openai api key here";

  local SUPABASE_URL = "your supabase url here";

  {
    "supabase_api_key":SUPABASE_API_KEY,
    "supabase_url":SUPABASE_URL,
    "openai_api_key":OPENAI_API_KEY,
  }

```

4. Database Configuration

-   Ensure that you have a PostgreSQL Vector database set up at [Supabase](https://supabase.com/vector).
-   Go to the SQL Editor tab in Supabase.
-   Create a new query using the New Query button.
-   Paste the following query into the editor and run it using the Run button in the bottom right corner.

```
create table if not exists documents (
    id bigint primary key generated always as identity,
    content text,
    embedding vector (1536)
  );

create or replace function public.match_documents (
   query_embedding vector(1536),
  similarity_threshold float,
    match_count int
)
returns table (
  id bigint,
  content text,
  similarity float
)
language sql
as $$
  select
  id,
  content,
   1- (documents.embedding <=> query_embedding) as similarity
  from documents
  where 1 - (documents.embedding <=> query_embedding) > similarity_threshold
  order by documents.embedding <=> query_embedding
  limit match_count;
  $$;

```

-   You should see a success message in the Result tab.
    ![image](https://github.com/Shyam-Raghuwanshi/EdgeChains/assets/94217498/052d9a15-838f-4e68-9888-072cecb78a13)

## Usage

1. Start the server:

    ```bash
    npm run start
    ```

2. Hit the `GET` endpoint.

    ```bash
    http://localhost:3000/chatWithpdf?question=who is nirmala sitaraman
    ```

-   Then you can run the ChatWithPdf example using npm run start and continue chatting with the example.pdf.

⚠️👉Remember: Comment out the InsertToSupabase function if you are running the code again; otherwise, the PDF data will be pushed again to the Supabase vector data.

---
