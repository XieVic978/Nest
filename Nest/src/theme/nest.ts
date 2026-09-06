// Visual-only design tokens based on the Nest product handoff. Keep feature
// behavior in the screens; use this module only to make surfaces consistent.
export const nestTheme = {
  colors: {
    canvas: "#FFFCF5",
    surface: "#FFFFFF",
    ink: "#24374B",
    muted: "#6B7785",
    blue: "#4975A8",
    blueDark: "#355E90",
    sand: "#F5D59C",
    sandPale: "#FFF3D8",
    teal: "#DFF0EE",
    tealInk: "#2D6C6A",
    coral: "#EE8069",
    coralPale: "#FCE8E2",
    border: "#E4E8E8",
  },
  radius: { card: 20, control: 14, chip: 10 },
} as const;
