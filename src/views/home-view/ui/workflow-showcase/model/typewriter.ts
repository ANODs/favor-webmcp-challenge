export type TypewriterRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type TypewriterGrapheme = {
  index: number;
  segment: string;
};

const clampProgress = (progress: number) => {
  if (Number.isNaN(progress)) return 0;
  return Math.min(1, Math.max(0, progress));
};

export const segmentTypewriterGraphemes = (
  value: string,
  locale?: string,
): TypewriterGrapheme[] => {
  if (typeof Intl.Segmenter !== "function") {
    let index = 0;
    return Array.from(value, (segment) => {
      const grapheme = { index, segment };
      index += segment.length;
      return grapheme;
    });
  }

  const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
  return Array.from(segmenter.segment(value), ({ index, segment }) => ({
    index,
    segment,
  }));
};

export const splitTypewriterGraphemes = (
  value: string,
  locale?: string,
) => segmentTypewriterGraphemes(value, locale).map(({ segment }) => segment);

export const getVisibleTypewriterGlyphCount = (
  glyphCount: number,
  progress: number,
) => Math.floor(Math.max(0, glyphCount) * clampProgress(progress));

export const mergeTypewriterLineRects = (
  glyphs: readonly TypewriterRect[],
): TypewriterRect[] => {
  const lineTolerance = 2;
  const lines: TypewriterRect[] = [];

  glyphs.forEach((glyph) => {
    const line = lines.find(
      (candidate) => Math.abs(candidate.y - glyph.y) <= lineTolerance,
    );

    if (!line) {
      lines.push({ ...glyph });
      return;
    }

    const right = Math.max(line.x + line.width, glyph.x + glyph.width);
    const bottom = Math.max(line.y + line.height, glyph.y + glyph.height);
    line.x = Math.min(line.x, glyph.x);
    line.y = Math.min(line.y, glyph.y);
    line.width = right - line.x;
    line.height = bottom - line.y;
  });

  return lines.sort((left, right) => left.y - right.y || left.x - right.x);
};
