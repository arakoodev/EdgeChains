import type { FC } from 'hono/jsx';
import { Layout } from './Layout';

export const HydeUI: FC<{  }> = (props) => {
  const styles = `
  /* Style the layout */
  .Layout {
    max-width: 800px;
    margin: 0 auto;
    padding: 20px;
    background-color: #f0f0f0;
    border: 1px solid #ccc;
    border-radius: 5px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }

  /* Style the header */
  h1 {
    font-size: 24px;
    color: #333;
    margin: 0;
  }

  /* Style the form */
  form {
    margin-top: 20px;
  }

  label {
    font-weight: bold;
  }

  textarea {
    width: 100%;
    height: 100px;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    font-size: 16px;
    margin-top: 5px;
  }

  button {
    background-color: #007bff;
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 10px 20px;
    font-size: 18px;
    cursor: pointer;
  }

  button:hover {
    background-color: #0056b3;
  }

  /* Style the result div */
  #result {
    margin-top: 20px;
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 10px;
    background-color: #fff;
    box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
  }
  .htmx-indicator {
    opacity: 0;
    transition: opacity 500ms ease-in;
  }
  
  .htmx-request .htmx-indicator, .htmx-request.htmx-indicator {
    opacity: 1;
    content: "";
    display: block;
    width: 40px;
    height: 40px;
    border: 4px solid #ccc;
    border-top: 4px solid #007bff; /* Customize the color */
    border-radius: 50%;
    animation: spin 2s linear infinite; /* Add a spinning animation */
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

return (
  <Layout>
    <div>
    <style>{styles}</style>
    <div className="Layout">
      <h1>ChatGPT Query</h1>
      <form className="form" hx-post="/hyde-search/query-rrf?topK=5" hx-trigger="submit" hx-target="#result" hx-include="[name='jsonData']" hx-indicator="#loading-indicator">
        <label htmlFor="jsonData">Enter query details:</label>
        <textarea id="jsonData" name="jsonData" required></textarea>
        <br /><br />
        <button type="submit">Submit</button>
        <div id="loading-indicator" class="htmx-indicator"></div>
      </form>
      <div id="result"></div>
    </div>
  </div>
  </Layout>
);
};