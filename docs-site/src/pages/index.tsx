import React from 'react';
import {Redirect} from '@docusaurus/router';

export default function Home(): React.ReactElement {
  return <Redirect to="/docs/category/getting-started-with-saiki" />;
}
