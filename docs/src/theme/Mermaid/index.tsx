import React from 'react';
import OriginalMermaid from '@theme-original/Mermaid';
import ExpandableMermaid from '@site/src/components/ExpandableMermaid';

// This wrapper automatically adds an "expand" overlay to every Mermaid diagram
// rendered in the documentation. By overriding the default Mermaid component
// provided by `@docusaurus/theme-mermaid`, we make the functionality available
// project-wide without requiring authors to modify individual markdown files.

export default function MermaidWrapper(props: any) {
  // Prefer an explicit title prop if provided, otherwise fall back to a default.
  const { title = 'Diagram', ...rest } = props;
  
  return (
    <ExpandableMermaid title={title}>
      {/* Render the original Mermaid diagram */}
      <OriginalMermaid title={title} {...rest} />
    </ExpandableMermaid>
  );
} 