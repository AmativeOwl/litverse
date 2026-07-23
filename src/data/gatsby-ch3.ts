import type { Passage } from '../types'

// Trivial fixture — Track D (feat/content) replaces this with the segmented
// Chapter 3 party-scene passage.
export const gatsbyCh3: Passage = {
  id: 'gatsby-ch3',
  title: 'Chapter 3',
  paragraphs: [
    {
      id: 'p1',
      sentences: [
        {
          id: 's1',
          sceneBeatId: 'arrival',
          words: [
            { id: 'w1', text: 'In', normalized: 'in' },
            { id: 'w2', text: 'his', normalized: 'his' },
            { id: 'w3', text: 'blue', normalized: 'blue' },
            { id: 'w4', text: 'gardens', normalized: 'gardens' },
          ],
        },
      ],
    },
  ],
}
