const SPEAKER_PREFIX_REGEX = /^\*\*Speaker\s+\d+:\*\*\s*/i;

const normalizeToken = (token: string): string =>
  token
    .toLowerCase()
    .replace(/[^\p{L}\p{N}']/gu, '')
    .trim();

export interface TranscriptMergeResult {
  mergedTranscript: string;
  mergedPlainText: string;
  audioTranscript: string;
  confidence: 'high' | 'medium' | 'low';
  usedAudioTail: boolean;
  warning: string | null;
}

export const extractPlainTranscript = (transcript: string): string => {
  if (!transcript.trim()) return '';
  return transcript
    .split('\n')
    .map((line) => line.replace(SPEAKER_PREFIX_REGEX, '').trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const findTailOverlap = (liveWords: string[], audioWords: string[]): number => {
  const maxOverlap = Math.min(liveWords.length, audioWords.length);
  for (let overlap = maxOverlap; overlap >= 1; overlap -= 1) {
    let matches = true;
    for (let i = 0; i < overlap; i += 1) {
      if (liveWords[liveWords.length - overlap + i] !== audioWords[i]) {
        matches = false;
        break;
      }
    }
    if (matches) return overlap;
  }
  return 0;
};

const appendSpeakerSegment = (baseTranscript: string, segmentText: string): string => {
  const cleanSegment = segmentText.trim();
  if (!cleanSegment) return baseTranscript;
  if (!baseTranscript.trim()) return `**Speaker 1:** ${cleanSegment}`;
  return `${baseTranscript.trim()}\n\n**Speaker 1:** ${cleanSegment}`;
};

export const mergeTranscriptTail = (
  liveTranscript: string,
  audioTranscriptRaw: string
): TranscriptMergeResult => {
  const livePlain = extractPlainTranscript(liveTranscript);
  const audioTranscript = audioTranscriptRaw.trim().replace(/\s+/g, ' ');

  if (!audioTranscript) {
    return {
      mergedTranscript: liveTranscript.trim(),
      mergedPlainText: livePlain,
      audioTranscript: '',
      confidence: 'medium',
      usedAudioTail: false,
      warning: null,
    };
  }

  if (!livePlain) {
    return {
      mergedTranscript: `**Speaker 1:** ${audioTranscript}`,
      mergedPlainText: audioTranscript,
      audioTranscript,
      confidence: 'high',
      usedAudioTail: true,
      warning: null,
    };
  }

  const liveWordRaw = livePlain.split(/\s+/).filter(Boolean);
  const audioWordRaw = audioTranscript.split(/\s+/).filter(Boolean);
  const liveWords = liveWordRaw.map(normalizeToken).filter(Boolean);
  const audioWords = audioWordRaw.map(normalizeToken).filter(Boolean);

  const overlap = findTailOverlap(liveWords, audioWords);
  const minSafeOverlap = 3;

  if (overlap >= Math.min(minSafeOverlap, audioWords.length)) {
    const remainingAudio = audioWordRaw.slice(overlap).join(' ').trim();
    const mergedPlainText = remainingAudio ? `${livePlain} ${remainingAudio}` : livePlain;
    const mergedTranscript = remainingAudio
      ? appendSpeakerSegment(liveTranscript, remainingAudio)
      : liveTranscript.trim();

    return {
      mergedTranscript,
      mergedPlainText,
      audioTranscript,
      confidence: remainingAudio ? 'high' : 'medium',
      usedAudioTail: !!remainingAudio,
      warning: null,
    };
  }

  return {
    mergedTranscript: liveTranscript.trim(),
    mergedPlainText: livePlain,
    audioTranscript,
    confidence: 'low',
    usedAudioTail: false,
    warning: null,
  };
};
