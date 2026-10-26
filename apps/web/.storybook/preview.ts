import type { Preview } from '@storybook/nextjs-vite';

import '../src/app/globals.css';
import './preview.css';

const preview: Preview = {
  parameters: {
    layout: 'centered',
  },
};

export default preview;
