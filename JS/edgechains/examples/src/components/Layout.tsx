import type { FC } from 'hono/jsx';

export const Layout: FC = (props) => {
    return (
      <html>
      <head>
          <title>ChatGPT Query</title>
          <script src="https://unpkg.com/htmx.org@1.5.0/dist/htmx.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/handlebars.js/4.7.7/handlebars.min.js"></script>
          <link rel="stylesheet" type="text/css" href="../style/hyde.css"></link>
      </head>
        <body>{props.children}</body>
      </html>
    )
  }