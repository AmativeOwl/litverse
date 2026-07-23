export interface Word {
  id: string
  text: string
  normalized: string
}

export interface Sentence {
  id: string
  words: Word[]
  sceneBeatId: string
  speakerId?: string
}

export interface Paragraph {
  id: string
  sentences: Sentence[]
}

export interface Passage {
  id: string
  title: string
  paragraphs: Paragraph[]
}

export interface SceneBeat {
  id: string
  palette: {
    background: string
    primary: string
    accent: string
    fog: string
  }
  lighting: {
    ambientIntensity: number
    keyLightIntensity: number
    keyLightColor: string
    bloomStrength: number
  }
  particles: {
    type: 'bokeh' | 'confetti' | 'embers' | 'dust' | 'none'
    density: number
    speed: number
    sizeRange: [number, number]
  }
  camera: {
    behavior: 'slow-orbit' | 'static-drift' | 'push-in' | 'pull-back'
    speed: number
    fov: number
  }
  silhouettes?: {
    count: number
    animation: 'sway' | 'still'
    namedSlots?: { characterId: string; instanceIndex: number }[]
  }
  transitionDurationMs: number
}
