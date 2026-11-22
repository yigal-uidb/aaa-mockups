import React from 'react';
import { Composition } from 'remotion';
import { Film } from './Film';
import timeline from './timeline.json';

export const Root: React.FC = () => (
  <Composition id="Film" component={Film} durationInFrames={timeline.total} fps={timeline.fps} width={1920} height={1080} />
);
