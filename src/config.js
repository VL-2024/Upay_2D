export const CONFIG = {
  version: '0.1.32-alpha',
  currency: 'сом',
  denominations: [25, 50, 100],
  defaultDenomination: 50,
  scene: {
    backgroundImage: './assets/ref/upay_background_ground.webp',
    carpetImage: './assets/ref/upay_carpet_blue.webp',

    // Visual placement. All values are relative to the game shell.
    carpetCenterX: 0.50,
    carpetCenterY: 0.408,
    carpetWidth: 0.820,
    carpetHeight: 0.290,

    // Piece pile is configured independently from the carpet.
    pileCenterX: 0.50,
    pileCenterY: 0.455,
    pileRadiusX: 0.335,
    pileRadiusY: 0.118,

    // How far a knocked chuko must travel beyond the visible carpet edge.
    edgeOutsetPx: 28,
  },
  pieces: {
    normalCount: 15,
    scaleMin: 0.145,
    scaleMax: 0.185,
    khanScale: 0.285,
  },
  zones: {
    totalSlots: 6,
    slotsPerUpay: 3,
  },
  ui: {
    selectedTint: 0xdaf6ff,
    selectedGlow: 0x6ac7ff,
  }
};