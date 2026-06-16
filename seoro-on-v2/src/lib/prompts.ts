export const STYLE_BLOCK = `Soft hand-painted storybook illustration, gentle watercolor and gouache textures with a light paper grain. Warm, nostalgic atmosphere bathed in soft golden natural light with tender, low-contrast shading. Cozy muted palette of warm amber, cream, soft sky blue and gentle sage green. Rounded, soft outlines; simple uncluttered composition with comfortable negative space and one clear focal point. Kind, warm Korean characters shown gently from a slight distance or three-quarter view; peaceful, heartwarming mood. Painterly, hand-drawn animation-still feel — calm, wholesome, easy and comfortable for all ages including the elderly.
Avoid: any text, letters, numbers, logos or watermark; photorealism; harsh shadows; neon or oversaturated colors; cluttered or busy backgrounds; distorted faces or hands.`

export function buildImagePrompt(scene: string): string {
  return `${STYLE_BLOCK}\nScene: ${scene}\nAspect ratio 4:3, centered storybook framing.`
}
