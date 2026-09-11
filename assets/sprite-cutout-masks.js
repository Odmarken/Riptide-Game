/* Reviewed corrections in ORIGINAL source pixels; the PNG files stay untouched.
 * Rectangles are [x, y, width, height]. Do not scale them before mask processing.
 * Holes use a four-neighbour flood from seed, accepting alpha >= alpha,
 * min(R,G,B) >= minimum and max(R,G,B)-min(R,G,B) <= chroma.
 * Keep size checks: a replacement asset must be reviewed before using this mask.
 */
const SPRITE_CUTOUT_MASKS={
 pickaxe:{
  size:[701,900],
  // Detached background islands. x=379 beside the first box is real edge paint.
  rects:[[380,168,33,41],[381,422,24,34],[386,453,15,21],[439,123,12,13]]
 },
 staff:{
  size:[207,1201],
  // White background inside the wooden opening, outside the blue crystal.
  // Never clear the component's bounding box: it also contains real artwork.
  holes:[{seed:[100,75],minimum:235,chroma:15,alpha:245}]
 }
};
