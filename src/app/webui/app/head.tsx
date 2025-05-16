/**
 * Returns the HTML head elements for the Saiki Agent web application.
 *
 * Includes the page title, character encoding, viewport settings, external stylesheet, and a robot emoji favicon.
 */
export default function Head() {
  return (
    <>
      <title>Saiki Agent</title>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <link rel="stylesheet" href="/style.css" />
      <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>" />
    </>
  );
} 