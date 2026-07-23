import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TextPane from './TextPane'
import { useReadingStore } from '../store/readingStore'
import type { Passage } from '../types'

// jsdom does not implement scrollIntoView.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

afterEach(() => {
  cleanup()
  // Reset the store to its initial shape between tests so state doesn't leak.
  useReadingStore.setState({
    currentSentenceIndex: 0,
    currentWordId: null,
    activeSceneBeatId: null,
    activeSpeakerId: null,
    playbackState: 'idle',
  })
  vi.useRealTimers()
})

const fixturePassage: Passage = {
  id: 'test-passage',
  title: 'Test Passage',
  paragraphs: [
    {
      id: 'p1',
      sentences: [
        {
          id: 's1',
          sceneBeatId: 'beat-a',
          words: [
            { id: 'w1', text: 'The', normalized: 'the' },
            { id: 'w2', text: 'first', normalized: 'first' },
            { id: 'w3', text: 'sentence.', normalized: 'sentence' },
          ],
        },
        {
          id: 's2',
          sceneBeatId: 'beat-a',
          words: [
            { id: 'w4', text: 'The', normalized: 'the' },
            { id: 'w5', text: 'second', normalized: 'second' },
            { id: 'w6', text: 'sentence.', normalized: 'sentence' },
          ],
        },
      ],
    },
    {
      id: 'p2',
      sentences: [
        {
          id: 's3',
          sceneBeatId: 'beat-b',
          words: [
            { id: 'w7', text: 'The', normalized: 'the' },
            { id: 'w8', text: 'third', normalized: 'third' },
            { id: 'w9', text: 'sentence.', normalized: 'sentence' },
          ],
        },
      ],
    },
  ],
}

describe('TextPane word/sentence highlighting', () => {
  it('renders every word of the passage as text', () => {
    render(<TextPane passage={fixturePassage} />)
    expect(screen.getByText('first')).toBeInTheDocument()
    expect(screen.getByText('second')).toBeInTheDocument()
    expect(screen.getByText('third')).toBeInTheDocument()
  })

  it('marks the sentence matching currentSentenceIndex as active', () => {
    act(() => {
      useReadingStore.setState({ currentSentenceIndex: 1 })
    })
    render(<TextPane passage={fixturePassage} />)

    const activeSentence = document.querySelector('[data-sentence-index="1"]')
    const inactiveSentence = document.querySelector('[data-sentence-index="0"]')

    expect(activeSentence).toHaveAttribute('aria-current', 'true')
    expect(inactiveSentence).not.toHaveAttribute('aria-current')
  })

  it('highlights the word matching currentWordId', () => {
    act(() => {
      useReadingStore.setState({ currentSentenceIndex: 0, currentWordId: 'w2' })
    })
    render(<TextPane passage={fixturePassage} />)

    const activeWord = document.querySelector('[data-word-id="w2"]')
    const inactiveWord = document.querySelector('[data-word-id="w1"]')

    expect(activeWord).toHaveClass('bg-amber-400/80')
    expect(inactiveWord).not.toHaveClass('bg-amber-400/80')
  })

  it('renders no active word when currentWordId is null', () => {
    act(() => {
      useReadingStore.setState({ currentWordId: null })
    })
    render(<TextPane passage={fixturePassage} />)

    const highlighted = document.querySelectorAll('.bg-amber-400\\/80')
    expect(highlighted.length).toBe(0)
  })

  it('updates highlighting reactively when the store changes after mount', () => {
    render(<TextPane passage={fixturePassage} />)

    expect(document.querySelector('[data-sentence-index="0"]')).toHaveAttribute(
      'aria-current',
      'true',
    )

    act(() => {
      useReadingStore.setState({ currentSentenceIndex: 2, currentWordId: 'w8' })
    })

    expect(document.querySelector('[data-sentence-index="0"]')).not.toHaveAttribute('aria-current')
    expect(document.querySelector('[data-sentence-index="2"]')).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(document.querySelector('[data-word-id="w8"]')).toHaveClass('bg-amber-400/80')
  })
})

describe('TextPane click-to-seek', () => {
  it('calls jumpToSentence with the clicked sentence global index', async () => {
    const user = userEvent.setup()
    render(<TextPane passage={fixturePassage} />)

    const thirdSentenceButton = document.querySelector<HTMLElement>('[data-sentence-index="2"]')
    expect(thirdSentenceButton).not.toBeNull()

    await user.click(thirdSentenceButton!)

    expect(useReadingStore.getState().currentSentenceIndex).toBe(2)
  })

  it('is keyboard-activatable (native button semantics)', async () => {
    const user = userEvent.setup()
    render(<TextPane passage={fixturePassage} />)

    const secondSentenceButton = document.querySelector<HTMLElement>('[data-sentence-index="1"]')
    expect(secondSentenceButton).not.toBeNull()

    secondSentenceButton!.focus()
    await user.keyboard('{Enter}')

    expect(useReadingStore.getState().currentSentenceIndex).toBe(1)
  })
})

describe('TextPane accessibility', () => {
  it("exposes each sentence button's accessible name as its actual text, not a generic label", () => {
    // Regression test: an earlier version set aria-label to "Jump to
    // sentence N", which overrides the accessible name computed from
    // content — screen reader users would hear only "Jump to sentence 1,
    // button" instead of the book text itself. The accessible name must
    // reflect the passage content so the reading experience is usable
    // with assistive tech.
    render(<TextPane passage={fixturePassage} />)

    expect(screen.getByRole('button', { name: 'The first sentence.' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'The third sentence.' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /jump to sentence/i })).not.toBeInTheDocument()
  })

  it('marks the active sentence with aria-current so assistive tech can announce reading position', () => {
    act(() => {
      useReadingStore.setState({ currentSentenceIndex: 1 })
    })
    render(<TextPane passage={fixturePassage} />)

    expect(screen.getByRole('button', { name: 'The second sentence.' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })
})

describe('TextPane auto-scroll', () => {
  it('scrolls the active word into view when currentWordId changes', () => {
    render(<TextPane passage={fixturePassage} />)
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scrollSpy.mockClear()

    act(() => {
      useReadingStore.setState({ currentWordId: 'w5' })
    })

    expect(scrollSpy).toHaveBeenCalled()
  })

  it('scrolls the active sentence into view when currentWordId is null', () => {
    render(<TextPane passage={fixturePassage} />)
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scrollSpy.mockClear()

    act(() => {
      useReadingStore.setState({ currentSentenceIndex: 1, currentWordId: null })
    })

    expect(scrollSpy).toHaveBeenCalled()
  })

  it('backs off auto-scroll after manual user scrolling, then resumes after inactivity', () => {
    vi.useFakeTimers()
    const { container } = render(<TextPane passage={fixturePassage} />)
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>

    // Let the mount's own programmatic-scroll grace window fully elapse so
    // the manual scroll below isn't mistaken for our own scrollIntoView call.
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    scrollSpy.mockClear()

    // Simulate the user manually scrolling the container (TextPane's
    // parent — RTL's render wrapper stands in for App.tsx's scrollable pane).
    fireEvent.scroll(container)

    // A word change while manual scrolling is still within its backoff
    // window should NOT trigger an auto-scroll.
    act(() => {
      useReadingStore.setState({ currentWordId: 'w4' })
    })
    expect(scrollSpy).not.toHaveBeenCalled()

    // After the full resume-delay window has elapsed with no further manual
    // scrolling, auto-scroll should resume.
    act(() => {
      vi.advanceTimersByTime(2600)
    })
    act(() => {
      useReadingStore.setState({ currentWordId: 'w5' })
    })
    expect(scrollSpy).toHaveBeenCalled()
  })

  it('does not treat its own programmatic scrollIntoView as manual scrolling', () => {
    vi.useFakeTimers()
    const { container } = render(<TextPane passage={fixturePassage} />)
    const scrollSpy = Element.prototype.scrollIntoView as ReturnType<typeof vi.fn>
    scrollSpy.mockClear()

    act(() => {
      useReadingStore.setState({ currentWordId: 'w2' })
    })
    expect(scrollSpy).toHaveBeenCalledTimes(1)

    // Fire a scroll event immediately after, simulating the browser's own
    // scroll event firing as a result of our scrollIntoView call.
    fireEvent.scroll(container)

    act(() => {
      useReadingStore.setState({ currentWordId: 'w3' })
    })
    // Should still have scrolled for the second word change, since the
    // scroll event right after our own call should have been ignored.
    expect(scrollSpy).toHaveBeenCalledTimes(2)
  })
})

describe('TextPane debug affordance', () => {
  it('play/pause debug button calls the store actions', async () => {
    const user = userEvent.setup()
    render(<TextPane passage={fixturePassage} />)

    expect(useReadingStore.getState().playbackState).toBe('idle')

    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(useReadingStore.getState().playbackState).toBe('playing')

    await user.click(screen.getByRole('button', { name: 'Pause' }))
    expect(useReadingStore.getState().playbackState).toBe('paused')
  })
})
