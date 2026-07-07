import { useMemo } from 'react';
import { DeckProvider, SlidesEditor } from '@weavertime/spindle-slides-react';
import { DeckImpl } from '@weavertime/spindle-slides-core';
import { buildSampleDeck } from './sampleDeck';

export default function App() {
  const deck = useMemo(() => {
    const d = new DeckImpl('demo-deck');
    d.setData(buildSampleDeck());
    return d;
  }, []);

  return (
    <DeckProvider deck={deck}>
      <SlidesEditor />
    </DeckProvider>
  );
}
