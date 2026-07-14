export const DEFAULT_FLIGHT_SETTINGS = {
  speed: 'normal',
  height: 'center',
  effect: 'steady',
  plane: 'gif',
  planeSize: '1',
  particle: 'classic',
  bubble: 'classic',
  bubblePosition: 'top',
  bubbleSize: '1',
  bubbleBgColor: '#ffffff',
  bubbleFontColor: '#333333',
  sound: 'whoosh',
  soundMode: 'once',
  useSound: false,
};

export const FLIGHT_PRESETS = {
  work: {
    labelKey: 'preset.name.work',
    speed: 'normal', height: 'center', effect: 'steady',
    plane: 'classic', particle: 'classic', bubble: 'classic', bubblePosition: 'top',
    sound: 'dingdong', soundMode: 'once',
  },
  quick: {
    labelKey: 'preset.name.quick',
    speed: 'fast', height: 'center', effect: 'swift',
    plane: 'jet', particle: 'jet', bubble: 'jet', bubblePosition: 'top',
    sound: 'whoosh', soundMode: 'once',
  },
  festive: {
    labelKey: 'preset.name.festive',
    speed: 'slow', height: 'top', effect: 'playful',
    plane: 'butterfly', particle: 'spark', bubble: 'butterfly', bubblePosition: 'top',
    sound: 'bird', soundMode: 'once',
  },
  anniversary: {
    labelKey: 'preset.name.anniversary',
    speed: 'normal', height: 'center', effect: 'ceremony',
    plane: 'paper', particle: 'cloud', bubble: 'glass', bubblePosition: 'top',
    sound: 'bell', soundMode: 'once',
  },
  night: {
    labelKey: 'preset.name.night',
    speed: 'vslow', height: 'bottom', effect: 'linear',
    plane: 'paper', particle: 'cloud', bubble: 'jet', bubblePosition: 'bottom',
    sound: 'soft', soundMode: 'once',
  },
};
