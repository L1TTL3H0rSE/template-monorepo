/* Файл сгенерирован из src/breakpoints.json. Не редактируйте вручную. */

export const breakpoints = {
  mobile: 374,
  mobile_large: 427,
  tablet_small: 599,
  tablet: 767,
  tablet_large: 1023,
  laptop: 1279,
  desktop: 1439,
  desktop_large: 1900,
} as const;

export type BreakpointName = keyof typeof breakpoints;
