import type { ColorValue } from './components/ui/types.js';

// ── Grid & Layout ────────────────────────────────────────────
export const TILE_SIZE = 16;
export const DEFAULT_COLS = 20;
export const DEFAULT_ROWS = 11;
export const MAX_COLS = 64;
export const MAX_ROWS = 64;

// ── Character Animation ─────────────────────────────────────
export const WALK_SPEED_PX_PER_SEC = 48;
export const WALK_FRAME_DURATION_SEC = 0.15;
export const TYPE_FRAME_DURATION_SEC = 0.3;
/** Tiles (Chebyshev, so diagonals count) around a marked Area that idle agents also keep clear of. */
export const AREA_IDLE_BUFFER_TILES = 1;
/** Area an agent with no Directory mapping works in, when one by this name is painted. */
export const SUPPORT_AREA_LABEL = 'Support';
export const WANDER_PAUSE_MIN_SEC = 2.0;
export const WANDER_PAUSE_MAX_SEC = 20.0;
export const WANDER_MOVES_BEFORE_REST_MIN = 3;
export const WANDER_MOVES_BEFORE_REST_MAX = 6;
export const SEAT_REST_MIN_SEC = 120.0;
export const SEAT_REST_MAX_SEC = 240.0;
/** Furniture whose seats are rest spots for idle agents (matched against the
 *  catalog type, case-insensitive). Cushioned chairs are deliberately absent. */
export const REST_SEAT_TYPE_PATTERN = /SOFA|BENCH/i;
/** Furniture an idle agent stands in front of to play (arcade machines). */
export const PLAY_FURNITURE_TYPE_PATTERN = /ARCADE/i;
/** How long an idle agent plays at a machine before wandering off. */
/** Vending machines and coffee: where a tired idle agent goes for a break
 *  (COFFEE_TABLE is a table, not a drink). */
export const BREAK_FURNITURE_TYPE_PATTERN = /^(?:VENDING_MACHINE|COFFEE(?!_TABLE))/i;
/** Seconds of work since the last break before an agent is worn out. */
export const TIRED_ACTIVE_SEC = 20 * 60;
/** Share of the context window that makes an agent tired... */
export const TIRED_CONTEXT_FRACTION = 0.85;
/** ...once it has also worked this long since its last break. */
export const TIRED_CONTEXT_MIN_ACTIVE_SEC = 3 * 60;
/** A tired agent that finds nowhere to recover is rested after this much idling. */
export const TIRED_IDLE_RECOVER_SEC = 90;
/** Break length at a vending machine / coffee; the agent perks up for the last
 *  BREAK_PERK_UP_SEC of it. */
export const BREAK_MIN_SEC = 14;
export const BREAK_MAX_SEC = 22;
export const BREAK_PERK_UP_SEC = 6;
/** Tired agents walk and type at this share of normal speed. */
export const TIRED_SPEED_FACTOR = 0.7;
/** A yawn lasts this long, once every TIRED_YAWN_PERIOD_SEC. */
export const TIRED_YAWN_SEC = 1.6;
export const TIRED_YAWN_PERIOD_SEC = 7;
/** Floating Zzz: one letter every this many seconds, each rising for TIRED_Z_RISE_SEC. */
export const TIRED_Z_RISE_SEC = 2.4;
export const TIRED_Z_COUNT = 3;
/** Zzz draws above furniture and walls, not just its agent. */
export const TIRED_Z_Z_SORT_BOOST = 10000;
export const TIRED_Z_RISE_PX = 12;
export const PLAY_MIN_SEC = 60.0;
export const PLAY_MAX_SEC = 150.0;

// ── Matrix Effect ────────────────────────────────────────────
export const MATRIX_EFFECT_DURATION_SEC = 0.3;
export const MATRIX_TRAIL_LENGTH = 6;
export const MATRIX_SPRITE_COLS = 16;
export const MATRIX_SPRITE_ROWS = 24;
export const MATRIX_FLICKER_FPS = 30;
export const MATRIX_FLICKER_VISIBILITY_THRESHOLD = 180;
export const MATRIX_COLUMN_STAGGER_RANGE = 0.3;
export const MATRIX_HEAD_COLOR = '#ccffcc';
export const matrixGreenBright = (a: number): string => `rgba(0, 255, 65, ${a})`;
export const matrixGreenMid = (a: number): string => `rgba(0, 170, 40, ${a})`;
export const matrixGreenDim = (a: number): string => `rgba(0, 85, 20, ${a})`;
export const MATRIX_TRAIL_OVERLAY_ALPHA = 0.6;
export const MATRIX_TRAIL_EMPTY_ALPHA = 0.5;
export const MATRIX_TRAIL_MID_THRESHOLD = 0.33;
export const MATRIX_TRAIL_DIM_THRESHOLD = 0.66;

// ── Rendering ────────────────────────────────────────────────
export const CHARACTER_SITTING_OFFSET_PX = 6;
/** A player at the side of an arcade machine stands on the machine's base
 *  line: drawn this far down so the feet meet the bottom of the cabinet. */
export const ARCADE_SIDE_PLAYER_OFFSET_PX = 8;
export const CHARACTER_Z_SORT_OFFSET = 0.5;
export const OUTLINE_Z_SORT_OFFSET = 0.001;
export const SELECTED_OUTLINE_ALPHA = 1.0;
export const HOVERED_OUTLINE_ALPHA = 0.5;
/** Headless agents (adopted, no terminal to focus) render slightly translucent. */
export const HEADLESS_CHARACTER_ALPHA = 0.5;
export const GHOST_PREVIEW_SPRITE_ALPHA = 0.5;
export const GHOST_PREVIEW_TINT_ALPHA = 0.25;
export const SELECTION_DASH_PATTERN: [number, number] = [4, 3];
export const BUTTON_MIN_RADIUS = 6;
export const BUTTON_RADIUS_ZOOM_FACTOR = 3;
export const BUTTON_ICON_SIZE_FACTOR = 0.45;
export const BUTTON_LINE_WIDTH_MIN = 1.5;
export const BUTTON_LINE_WIDTH_ZOOM_FACTOR = 0.5;
export const BUBBLE_FADE_DURATION_SEC = 0.5;
export const BUBBLE_SITTING_OFFSET_PX = 10;
export const BUBBLE_VERTICAL_OFFSET_PX = 24;
export const FALLBACK_FLOOR_COLOR = '#808080';

// ── Rendering - Overlay Colors (canvas, not CSS) ─────────────
export const SEAT_OWN_COLOR = 'rgba(0, 127, 212, 0.35)';
export const SEAT_AVAILABLE_COLOR = 'rgba(0, 200, 80, 0.35)';
export const SEAT_BUSY_COLOR = 'rgba(220, 50, 50, 0.35)';
export const GRID_LINE_COLOR = 'rgba(255,255,255,0.12)';
export const VOID_TILE_OUTLINE_COLOR = 'rgba(255,255,255,0.08)';
export const VOID_TILE_DASH_PATTERN: [number, number] = [2, 2];
export const GHOST_BORDER_HOVER_FILL = 'rgba(60, 130, 220, 0.25)';
export const GHOST_BORDER_HOVER_STROKE = 'rgba(60, 130, 220, 0.5)';
export const GHOST_BORDER_STROKE = 'rgba(255, 255, 255, 0.06)';
export const GHOST_VALID_TINT = '#00ff00';
export const GHOST_INVALID_TINT = '#ff0000';
export const SELECTION_HIGHLIGHT_COLOR = '#007fd4';
/** Erase tool: outline of the item / carpet / tile the next erase removes. */
export const ERASE_TARGET_COLOR = '#ff3b3b';
export const DELETE_BUTTON_BG = 'rgba(200, 50, 50, 0.85)';
export const ROTATE_BUTTON_BG = 'rgba(50, 120, 200, 0.85)';
export const BUTTON_ICON_COLOR = '#fff';
export const CANVAS_FALLBACK_TILE_COLOR = '#444';
export const CANVAS_ERROR_TILE_COLOR = '#FF00FF';
export const WALL_COLOR = '#3A3A5C';

// ── Camera ───────────────────────────────────────────────────
export const CAMERA_FOLLOW_LERP = 0.1;
export const CAMERA_FOLLOW_SNAP_THRESHOLD = 0.5;

// ── Zoom ─────────────────────────────────────────────────────
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 10;
export const ZOOM_DEFAULT_DPR_FACTOR = 2;
export const ZOOM_LEVEL_FADE_DELAY_MS = 1500;
export const ZOOM_LEVEL_HIDE_DELAY_MS = 2000;
export const ZOOM_LEVEL_FADE_DURATION_SEC = 0.5;
export const ZOOM_SCROLL_THRESHOLD = 50;
export const PAN_MARGIN_FRACTION = 0.25;

// ── Editor ───────────────────────────────────────────────────
export const UNDO_STACK_MAX_SIZE = 50;
export const LAYOUT_SAVE_DEBOUNCE_MS = 500;
/** data-testid of the office canvas — e2e drives real editor gestures on it. */
export const OFFICE_CANVAS_TEST_ID = 'office-canvas';
/** Attribute (`"top"` | `"bottom"`) on panels that border or cover the office:
 *  the fit-to-width button centres the office in the height left between the
 *  `top` panels and the `bottom` ones. */
export const FIT_OBSTACLE_ATTR = 'data-fit-obstacle';

/** View mode refits when the canvas, a panel or the layout changes; this is how
 *  often that is checked (panels resize without any event the app can hook). */
export const VIEW_FIT_CHECK_MS = 250;

/** View mode sits the office at the bottom of its band with this gap above
 *  the bottom panels; the spare height stays open above it. */
export const VIEW_BOTTOM_MARGIN_CSS_PX = 25;

/** View mode keeps at least this fraction of the canvas height (a quarter: the office takes 3/4) open above the
 *  office (room for the sky); landscape gives up a zoom step for it when needed. */
export const VIEW_OPEN_TOP_FRACTION = 0.25;
/** View mode's size menu: whole zoom steps it offers bigger than the fitted
 *  size (the office's width and the sky cap it sooner on a narrow screen). */
export const VIEW_ZOOM_MAX_EXTRA_STEPS = 1;
/** ...and smaller than it (wider gaps left and right; zoom never goes below 1). */
export const VIEW_ZOOM_MAX_LESS_STEPS = 5;
/** Open space kept above the office at the larger sizes, as a fraction of the
 *  canvas height (the sky and the agent cards). */
export const VIEW_ZOOM_OPEN_TOP_FRACTION = 0.05;
/** localStorage key for the chosen size level (a per-viewer convenience). */
export const VIEW_ZOOM_STORAGE_KEY = 'pixel-agents.viewZoomStep';
/** Ghost-border hover tile when the border isn't shown — off any reachable tile. */
export const GHOST_BORDER_NO_HOVER_TILE = -999;

// ── Layout Import/Export (browser-native, standalone) ────────
/** Suggested filename when exporting the office layout from the standalone browser. */
export const LAYOUT_EXPORT_FILENAME = 'pixel-agents-layout.json';
/** MIME type for the exported layout Blob. */
export const LAYOUT_EXPORT_MIME = 'application/json';
export const DEFAULT_FLOOR_COLOR: ColorValue = { h: 35, s: 30, b: 15, c: 0 };
export const DEFAULT_WALL_COLOR: ColorValue = { h: 240, s: 25, b: 0, c: 0 };
export const DEFAULT_NEUTRAL_COLOR: ColorValue = { h: 0, s: 0, b: 0, c: 0 };

// ── Carpets ──────────────────────────────────────────────────
/** Main (lowest-luminance) color applied to carpets when no per-tile override is set. */
export const CARPET_DEFAULT_COLOR: ColorValue = { h: 0, s: 71, b: -32, c: 0, colorize: true };
/** Accent (highest-luminance) color applied to carpets when no per-tile override is set. */
export const CARPET_DEFAULT_ACCENT_COLOR: ColorValue = {
  h: 34,
  s: 64,
  b: 21,
  c: 0,
  colorize: true,
};
/** Keyboard key that switches from CARPET_PAINT to CARPET_PICK while editing. */
export const KEY_CARPET_PICK = 'p';

// ── Areas (named, colored Directory zones) ───────────────────
/** Color palette assigned to new Areas in rotation (cycles when more areas exist). */
export const AREA_DEFAULT_COLORS: readonly string[] = [
  '#ff6b6b',
  '#feca57',
  '#48dbfb',
  '#1dd1a1',
  '#5f27cd',
  '#ff9ff3',
  '#54a0ff',
  '#ffa502',
] as const;
/** Translucent overlay alpha for area tile fills. */
export const AREA_OVERLAY_ALPHA = 0.25;
/** Alpha multiplier applied to the actively-selected area's overlay. */
export const AREA_ACTIVE_ALPHA_MULTIPLIER = 1.6;
/** Base font size (pixel-pre-zoom) for area centroid labels. */
export const AREA_LABEL_FONT_SIZE_PX = 14;
/** Minimum on-screen label size to keep labels legible at low zoom. */
export const AREA_LABEL_MIN_FONT_SIZE_PX = 12;
/** Alpha of the area label text. */
export const AREA_LABEL_ALPHA = 1.0;
/** Fallback label color when an area has no color set (shouldn't happen in practice). */
export const AREA_LABEL_FALLBACK_COLOR = '#ffffff';
/** Drop-shadow color behind area labels for legibility on light backgrounds. */
export const AREA_LABEL_SHADOW_COLOR = '#000000';
/** Drop-shadow alpha behind area labels. */
export const AREA_LABEL_SHADOW_ALPHA = 0.6;

// ── VisualColorPicker (HSV wheel + brightness for carpets) ───
export const VISUAL_COLOR_PICKER_SV_SIZE_PX = 180;
export const VISUAL_COLOR_PICKER_HUE_WIDTH_PX = 20;
export const VISUAL_COLOR_PICKER_MARKER_RADIUS_PX = 6;
/**
 * The hue bar gradient is intrinsic to the color-picking interaction, not a
 * theme color — it must span the full hue circle. Centralized here so the
 * component body stays free of inline color literals. (The saturation/brightness
 * square is painted to a canvas from the carpet HSL model, not a CSS gradient.)
 */
export const VISUAL_COLOR_PICKER_HUE_GRADIENT =
  'linear-gradient(to bottom, ' +
  '#ff0000 0%, #ffff00 16.7%, #00ff00 33.3%, ' +
  '#00ffff 50%, #0000ff 66.7%, #ff00ff 83.3%, #ff0000 100%)';
export const VISUAL_COLOR_PICKER_MARKER_BORDER = '2px solid #fff';
export const VISUAL_COLOR_PICKER_MARKER_SHADOW = '0 0 0 1px rgba(0,0,0,0.6)';
/** Width of the collapsed swatch + hex trigger row (compact mode). */
export const VISUAL_COLOR_PICKER_COMPACT_WIDTH_PX = 160;
/** Swatch square size shown in the collapsed trigger. */
export const VISUAL_COLOR_PICKER_SWATCH_PX = 22;
/** Gap (px) between the collapsed trigger and the expanded popup panel. */
export const VISUAL_COLOR_PICKER_POPUP_GAP_PX = 6;

// ── Notification Sound (done: ascending chime) ─────────────
export const NOTIFICATION_NOTE_1_HZ = 659.25; // E5
export const NOTIFICATION_NOTE_2_HZ = 1318.51; // E6 (octave up)
export const NOTIFICATION_NOTE_1_START_SEC = 0;
export const NOTIFICATION_NOTE_2_START_SEC = 0.1;
export const NOTIFICATION_NOTE_DURATION_SEC = 0.18;
export const NOTIFICATION_VOLUME = 0.14;

// ── Permission Sound (attention: descending double tap) ────
export const PERMISSION_NOTE_1_HZ = 880; // A5
export const PERMISSION_NOTE_2_HZ = 659.25; // E5 (down a fourth)
export const PERMISSION_NOTE_1_START_SEC = 0;
export const PERMISSION_NOTE_2_START_SEC = 0.12;
export const PERMISSION_NOTE_DURATION_SEC = 0.15;
export const PERMISSION_VOLUME = 0.12;

// ── Furniture Animation ─────────────────────────────────────
export const FURNITURE_ANIM_INTERVAL_SEC = 0.2;
/** A lava lamp is always lit; its lava drifts one frame per this many seconds. */
export const LAVA_LAMP_ANIM_INTERVAL_SEC = 0.8;
/** Placed-furniture type prefix shared by every lava lamp variant. */
export const LAVA_LAMP_TYPE_PREFIX = 'LAVA_LAMP';

// ── Version Notice ──────────────────────────────────────────
export const WHATS_NEW_AUTO_CLOSE_MS = 20000;
export const WHATS_NEW_FADE_MS = 1000;

// ── Game Logic ───────────────────────────────────────────────
export const MAX_DELTA_TIME_SEC = 0.1;
export const WAITING_BUBBLE_DURATION_SEC = 2.0;
export const DISMISS_BUBBLE_FAST_FADE_SEC = 0.3;
export const INACTIVE_SEAT_TIMER_MIN_SEC = 3.0;
export const INACTIVE_SEAT_TIMER_RANGE_SEC = 2.0;
/** Default/fallback palette count (bundled characters). Actual count comes from getLoadedCharacterCount(). */
export const PALETTE_COUNT = 6;
export const AUTO_ON_FACING_DEPTH = 3;
/** Furniture type prefixes of the racks (GB200 NVL72, DGX Spark rack), which light by Area rather than by desk. */
export const SERVER_RACK_TYPE_PREFIXES = ['SERVER_RACK', 'DGX_SPARK_RACK'] as const;
export const AUTO_ON_SIDE_DEPTH = 2;
export const CHARACTER_HIT_HALF_WIDTH = 8;
export const CHARACTER_HIT_HEIGHT = 24;
export const TOOL_OVERLAY_VERTICAL_OFFSET = 32;
/** Max width (CSS px) of the agent label panel: about 1⅓ long tables wide at
 *  default zoom (a 48-sprite-px table x default zoom 2 = 96 CSS px). */
export const TOOL_OVERLAY_MAX_WIDTH_PX = 128;

// ── Greeter + Intro bubble ──────────────────────────────────
/** Reserved character id for the Intro's greeter. Far outside both real agent
 *  ids (positive) and sub-agent ids (small negatives from -1 down). */
export const GREETER_ID = -1_000_000_000;
/** Stacking order for the Intro's bubble. Deliberately BELOW the modal stack
 *  (ui/Modal defaults to 50, ChangelogModal 51, the migration notice z-100): the
 *  Intro is diegetic furniture over the office, not a modal, so a modal opened
 *  on top of it must cover it rather than slide underneath. */
export const INTRO_BUBBLE_Z_INDEX = 45;
/** ToolOverlay stacking: status label panels (selected one on top), then the
 *  characters' speech bubbles above every label — all below the Intro bubble. */
export const OVERLAY_LABEL_Z_INDEX = 41;
export const OVERLAY_LABEL_SELECTED_Z_INDEX = 42;
export const OVERLAY_BUBBLE_Z_INDEX = 43;
/** Anything the user opens (toolbars hosting dropdowns, tooltips, colour picker
 *  popups, version popup) sits at z-44 (Tailwind `z-44`) so static office chrome —
 *  agent labels, speech bubbles — can never cover it. Keep in step with the class. */
export const POPUP_Z_INDEX = 44;
/** The greeter stands this many tiles in from the office's bottom-left corner
 *  (target tile (margin, rows-1-margin); nearest walkable tile if blocked). */
export const GREETER_TILE_MARGIN = 3;
/** World px above the greeter's anchor (feet) where the bubble's bottom sits.
 *  Kept well above the head target (INTRO_TAIL_TARGET_RISE_WORLD) so the
 *  tail squares have a visible run between bubble and head. */
export const INTRO_BUBBLE_ANCHOR_RISE_WORLD = 44;
/** World px right of the greeter's center where the bubble's left edge starts —
 *  just clear of the sprite so the tail points down-left at the head. */
export const INTRO_BUBBLE_OFFSET_X_WORLD = 10;
/** Bubble width cap (CSS px) and the margin kept from the container edges.
 *  Wide on purpose: the disclosure reads as three short paragraphs instead of
 *  a tall column (still clamped to the container on narrow panels). */
export const INTRO_BUBBLE_MAX_WIDTH_PX = 560;
export const INTRO_BUBBLE_EDGE_MARGIN_PX = 4;
/** Where the Intro's Claude Code step sends people who don't have it yet. */
export const CLAUDE_CODE_URL = 'https://claude.com/claude-code';
export const CLAUDE_CODE_INSTALL_COMMAND = 'npm install -g @anthropic-ai/claude-code';
/** Speech-tail squares: placed at fraction `t` along the segment from the
 *  bubble's nearest edge point to the greeter's head, shrinking toward the
 *  speaker. Recomputed every frame so the tail stays connected no matter where
 *  edge-clamping or panning puts the bubble relative to the character. */
export const INTRO_TAIL_STEPS = [
  { t: 0.25, size: 12 },
  { t: 0.55, size: 9 },
  { t: 0.82, size: 6 },
] as const;
/** World px above the greeter's anchor (feet) the tail points at — the head. */
export const INTRO_TAIL_TARGET_RISE_WORLD = 26;
/** Camera-offset caps while centering character + bubble. The ideal composition
 *  assumes the bubble fits beside/above the character; when it can't (narrow or
 *  short viewports clamp the bubble to the screen), uncapped offsets shove the
 *  greeter to the viewport edge. Horizontal offset is capped to this fraction
 *  of the viewport; vertical offset always keeps this many world px of the
 *  character visible above the bottom edge. */
export const INTRO_CAMERA_MAX_X_OFFSET_VIEWPORT_FRACTION = 0.25;
export const INTRO_CAMERA_MIN_CHAR_VISIBLE_WORLD = 48;
/** Extra downward camera shift (CSS px) so the character+bubble composition
 *  sits a bit above the vertical center instead of dead-centered. */
export const INTRO_CAMERA_DOWN_SHIFT_PX = 50;

// ── Context Fuel Gauge ──────────────────────────────────────
/** Window assumed before the runtime reports one (it always does for agents
 *  that have taken a turn; this only covers characters created ahead of it). */
export const DEFAULT_MAX_CONTEXT_TOKENS = 200_000;
export const CONTEXT_WARN_THRESHOLD = 0.6;
export const CONTEXT_DANGER_THRESHOLD = 0.8;
export const CONTEXT_CRITICAL_THRESHOLD = 0.95;
export const CONTEXT_GAUGE_WIDTH_PX = 40;
export const CONTEXT_GAUGE_HEIGHT_PX = 4;
export const CONTEXT_GAUGE_COLOR_OK = '#44cc44';
export const CONTEXT_GAUGE_COLOR_WARN = '#ffcc00';
export const CONTEXT_GAUGE_COLOR_DANGER = '#ff8800';
export const CONTEXT_GAUGE_COLOR_CRITICAL = '#ff2222';
export const CONTEXT_GAUGE_BG = '#222';

// ── Agent Teams ─────────────────────────────────────────────
export const TEAM_LEAD_COLOR = '#ffd700';
export const TEAM_ROLE_COLOR = '#66aaff';

// ── Pets ────────────────────────────────────────────────────────
/** Walking speed in world pixels per second (matches character walk speed visually but slower). */
export const PET_WALK_SPEED_PX_PER_SEC = 32;
/** Time per WALK animation cycle step (4 cycle steps × 0.15s = 0.6s per loop). */
export const PET_WALK_FRAME_DURATION_SEC = 0.15;
/** Time per IDLE animation cycle step (4 cycle steps × 0.3s = 1.2s per loop). */
export const PET_IDLE_FRAME_DURATION_SEC = 0.3;
/** Walk cycle: 4-step lookup into the 3-frame walkDown/walkUp/walkRight arrays. */
export const PET_WALK_SEQUENCE = [0, 1, 0, 2] as const;
/** Idle cycle: 4-step lookup into the 3-frame idleDown/idleUp arrays. */
export const PET_IDLE_SEQUENCE = [0, 1, 2, 1] as const;
/** Minimum seconds the pet stays in IDLE before making a new decision. */
export const PET_WANDER_PAUSE_MIN_SEC = 3.0;
/** Maximum seconds the pet stays in IDLE before making a new decision. */
export const PET_WANDER_PAUSE_MAX_SEC = 15.0;
/** Seconds between FOLLOW path re-computations. */
export const PET_FOLLOW_RECALC_INTERVAL_SEC = 1.0;
/** Probability that a pet enters FOLLOW (instead of WALK) when wanderTimer expires. */
export const PET_FOLLOW_CHANCE = 0.3;
/** Maximum Manhattan distance (tiles) at which a character can become a follow target. */
export const PET_FOLLOW_RADIUS_TILES = 3;
/** Minimum seconds a FOLLOW episode lasts before timing out. */
export const PET_FOLLOW_DURATION_MIN_SEC = 5.0;
/** Maximum seconds a FOLLOW episode lasts before timing out. */
export const PET_FOLLOW_DURATION_MAX_SEC = 15.0;
/** Hit-box half-width (world px) for pet click detection. */
/** How far (Manhattan tiles) the pet roams from its table. */
export const PET_HOME_RADIUS_TILES = 3;
/** Chance, at each idle decision, that a cat near a free table goes to sit on it. */
export const PET_PERCH_CHANCE = 0.35;
/** How close (Manhattan tiles from the table) a seated person must be for the cat to sit on it. */
export const PET_PERCH_SEATED_RADIUS_TILES = 3;
/** Same, for a person standing or walking. */
export const PET_PERCH_STANDING_RADIUS_TILES = 2;
/** Seconds a cat sits on the table before hopping down. */
export const PET_PERCH_DURATION_MIN_SEC = 8.0;
export const PET_PERCH_DURATION_MAX_SEC = 25.0;
/** Seconds a jump onto / off the table takes. */
export const PET_HOP_DURATION_SEC = 0.35;
/** Peak height (px) of the jump arc. */
export const PET_HOP_ARC_PX = 10;
/** Furniture-type substrings the pet picks as its table, best first. */
export const PET_HOME_TABLE_PATTERNS = ['TABLE_TENNIS', 'PING_PONG', 'TABLE'] as const;
/** Seat furniture a dog may jump onto when nobody is sitting there or heading to it. */
export const PET_SOFA_TYPE_PATTERN = /SOFA|COUCH/i;
/** Furniture type a cat may climb onto (its top platform). */
export const PET_CAT_TREE_TYPE_PATTERN = /CAT_TREE/i;
/** Chance, at each idle decision, that a cat climbs a free cat tree. */
export const PET_CAT_TREE_CHANCE = 0.4;
/** Cat on a tree: feet this far (px) below the top of the tree's sprite (its top platform). */
export const PET_CAT_TREE_PERCH_Y_PX = 9;
/** How far (Manhattan tiles) from the pet's table a sofa or lap may be for it to go there. */
export const PET_SEAT_SEARCH_RADIUS_TILES = 6;
/** Chance, at each idle decision, that a dog goes to a free sofa. */
export const PET_SOFA_CHANCE = 0.35;
/** Chance, at each idle decision, that a cat goes to a seated agent's lap. */
export const PET_LAP_CHANCE = 0.35;
/** Dog on a sofa: feet this far (px) below the seat tile's centre (on the cushion). */
export const PET_SOFA_SEAT_Y_OFFSET_PX = 3;
/** Cat on a lap: feet this far (px) below the agent's tile centre (the seated lap). */
export const PET_LAP_Y_OFFSET_PX = 9;
/** Cat on a sideways-facing lap: shift (px) toward the way the agent faces. */
export const PET_LAP_SIDE_SHIFT_PX = 3;
/** Chance, at each idle decision, that a dog chases a walking agent to bite its leg. */
export const PET_BITE_CHANCE = 0.3;
/** How close (Manhattan tiles) a walking agent must be for the dog to chase it. */
export const PET_BITE_RADIUS_TILES = 5;
/** Dog's running speed while chasing a leg (agents walk at 48 px/s). */
export const PET_CHASE_SPEED_PX_PER_SEC = 64;
/** Seconds between path re-computations while chasing (the target keeps moving). */
export const PET_CHASE_RECALC_INTERVAL_SEC = 0.3;
/** Give up a chase after this many seconds. */
export const PET_CHASE_MAX_SEC = 8.0;
/** The dog grabs the leg once this close (world px between feet). */
export const PET_BITE_REACH_PX = 12;
/** Seconds of slowed walk each tick of a bite grants the agent (the pet renews it every tick). */
export const PET_BITE_DRAG_HOLD_SEC = 1.0;
/** Seconds before a dog may bite a leg again. */
export const PET_BITE_COOLDOWN_SEC = 20.0;
/** An agent dragging a dog walks at this fraction of its normal speed. */
export const PET_DRAG_SPEED_FACTOR = 0.4;
/** The dragged pose treats the top this share of the side sprite's height as
 *  head + body, and the rest as legs (laid trailing behind)... */
export const PET_BITE_BODY_SHARE = 0.7;
/** ...squashes the body below the back line to this share of its height... */
export const PET_BITE_FLAT_SHARE = 0.55;
/** ...keeps the head full size, with this many rows of neck under the back line... */
export const PET_BITE_HEAD_NECK_ROWS = 2;
/** ...and shears each squashed leg row this many px further back. */
export const PET_BITE_LEG_TRAIL_PX_PER_ROW = 2;
/** The dragged pose dips its head to the boot by tipping forward (degrees, clockwise). */
export const PET_BITE_TILT_DEG = 4;
/** Bite frames are this square size (px); nose at the right edge, belly at the bottom. */
export const PET_BITE_FRAME_PX = 32;
/** Biting dog's sprite centre: this far (px) to the side of the agent's centre,
 *  which puts its nose on the leg (frame half-width minus 4). */
export const PET_BITE_SIDE_OFFSET_PX = 12;
/** When the agent walks up or down, the dog trails this far (px) behind it. */
export const PET_BITE_TRAIL_PX = 3;
/** Dragged up the screen (agent walking up), the dog lies below the agent with
 *  its head at the top of the sprite: this far (px) below the agent's feet. */
export const PET_BITE_UP_TRAIL_PX = 9;
/** Rows of head (ears to chin) kept at full size in the vertical drag poses. */
export const PET_BITE_VERT_HEAD_ROWS = 5;
export const PET_HIT_HALF_WIDTH = 8;
/** Hit-box height (world px) measured upward from the bottom-center anchor. */
export const PET_HIT_HEIGHT = 16;
/** Zoom factor used to draw pet thumbnails in the EditorToolbar Pets tab. */
export const PET_THUMB_ZOOM = 2;
/** Scale margin so the pet thumbnail fills the ItemSelect cell without touching the edges. */
export const PET_THUMB_SCALE_MARGIN = 0.85;
/** Fallback background fill for sprite-less thumbnail (used while pet sprites are loading). */
export const EMPTY_SPRITE_THUMBNAIL_BG = '#333';
/** Maximum string length for a PlacedPet.id (defends against pathologically-long layout entries). */
export const MAX_PET_ID_LENGTH = 128;

// ── WebSocket reconnect (standalone only) ────────────────────
/** Reconnect backoff ladder shared by the /ws transport and every terminal
 *  socket (transport/reconnectBackoff.ts). The last rung repeats. */
export const WS_RECONNECT_DELAYS_MS = [250, 500, 1_000, 2_000, 4_000] as const;

// ── Terminal drawer (standalone only) ────────────────────────

// This file is the one place inline colors are allowed (see eslint.config.js),
// which is why xterm's theme lives here rather than next to the component.

// The panel docks on the right as a full-height column, in flow beside the
// office region (which flexes to fill the rest) — not overlaid on top of it.
/** Open width the panel starts at, in px; the user can drag to resize. */
export const TERMINAL_DRAWER_DEFAULT_WIDTH_PX = 520;
/** Clamp for the drag: never narrower than this. */
export const TERMINAL_DRAWER_MIN_WIDTH_PX = 320;
/** Clamp for the drag: never wider than this fraction of the window. */
export const TERMINAL_DRAWER_MAX_WIDTH_RATIO = 0.8;
/** Minimum strip of window the terminal panel's drag leaves for the office. */
export const TERMINAL_SIDEBAR_WIDTH_PX = 72;
/** Max width of the agent name on a desktop card, in px; longer names
 *  truncate with an ellipsis (the full name is the card's tooltip). */
export const AGENT_CARD_NAME_MAX_WIDTH_PX = 200;
/** Grab width of the drag handle on the panel's left edge. */
export const TERMINAL_DRAWER_RESIZE_HANDLE_PX = 6;

// Mug shot: a square crop of the agent's front-facing sprite, focused on the
// face, shown in each terminal tab in place of an "Agent N" label. Sprites are
// 16 wide × 32 tall; the head runs to about row 18 (eyes ~row 14). The square is
// wider than the 16px sprite, so the head sits centred with a little air.
// Tweak these three to reframe: SIDE = zoom out/in, TOP = raise/lower the crop,
// LEFT = shift left/right (negative centres a square wider than the sprite).
export const MUGSHOT_CROP_TOP_ROW = 0;
export const MUGSHOT_CROP_LEFT_COL = -1;
export const MUGSHOT_CROP_SIDE_PX = 20;
/** Integer sprite-pixel zoom. 2 = each sprite pixel is 2 px. */
export const MUGSHOT_RENDER_ZOOM = 2;
/** On-screen size in CSS px. Equal to the backing canvas (crop × zoom) so there
 *  is no fractional scaling — the mug shot stays pixel-perfect. */
export const MUGSHOT_DISPLAY_PX = MUGSHOT_CROP_SIDE_PX * MUGSHOT_RENDER_ZOOM;
/** Terminal CONTENT is monospace on purpose: FS Pixel Sans is not a mono font,
 *  and a TUI mis-renders in a proportional face. The drawer chrome around it
 *  still uses the pixel font. */
export const TERMINAL_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
export const TERMINAL_FONT_SIZE_PX = 13;
/** Lines xterm retains client-side (independent of the server's replay ring). */
export const TERMINAL_SCROLLBACK_LINES = 5_000;
/** Debounce for propagating a resize to the PTY (fit on every frame thrashes it). */
export const TERMINAL_RESIZE_DEBOUNCE_MS = 100;
/** URL schemes a click in the terminal pane may open (see terminalLinks.ts). */
export const TERMINAL_LINK_PROTOCOLS: readonly string[] = ['http:', 'https:'];
/** window.open features for terminal links: no opener handle, no Referer. */
export const TERMINAL_LINK_WINDOW_FEATURES = 'noopener,noreferrer';
/** THE plain-URL pattern of the terminal pane: TerminalPane hands it to
 *  @xterm/addon-web-links (`urlRegex`) for mouse clicks and urlAtCell matches
 *  it for touch taps, so a URL that is clickable is exactly one that is
 *  tappable. Equivalent to the addon's built-in strictUrlRegex. Deliberately
 *  NOT global: the addon rebuilds it as `new RegExp(source, flags + 'g')`, so
 *  a `g` here would throw on the duplicate flag; matchAll callers make their
 *  own global copy. */
export const TERMINAL_URL_PATTERN =
  /(https?|HTTPS?):[/]{2}[^\s"'!*(){}|\\^<>`]*[^\s"':,.!?{}|\\^~[\]`()<>]/;
/** Largest OSC 52 clipboard write the terminal honours (clipboardKeys.ts),
 *  in base64 characters (~3 MB of text). Bigger ones are dropped rather than
 *  decoded: a runaway program shouldn't be able to stall the page. */
export const TERMINAL_OSC52_MAX_BASE64_CHARS = 4_000_000;

/** xterm theme, matched to the office palette (index.css :root). */
export const TERMINAL_THEME = {
  background: '#181828',
  foreground: 'rgba(255, 255, 255, 0.9)',
  cursor: '#6030ff',
  cursorAccent: '#181828',
  selectionBackground: 'rgba(96, 48, 255, 0.4)',
  black: '#1e1e2e',
  red: '#d14249',
  green: '#89d185',
  yellow: '#cca700',
  blue: '#3794ff',
  magenta: '#746fff',
  cyan: '#4ad9d9',
  white: 'rgba(255, 255, 255, 0.9)',
  brightBlack: '#4a4a6a',
  brightRed: '#ff6b72',
  brightGreen: '#a8e5a4',
  brightYellow: '#ffd700',
  brightBlue: '#66aaff',
  brightMagenta: '#a29bff',
  brightCyan: '#7fe8e8',
  brightWhite: '#ffffff',
} as const;

// ── Mobile shell ─────────────────────────────────────────────
// Below this the app swaps the desktop drawer layout for the mobile shell:
// office and terminal as full-screen pages in a sliding track, with the agent
// cards in a bottom scroller. Phones match the first clause in either
// orientation; the second catches touch tablets (iPad portrait/landscape)
// where the drag-to-resize drawer is unusable anyway.
export const MOBILE_MEDIA_QUERY = '(max-width: 768px), ((pointer: coarse) and (max-width: 1024px))';
/** Slide duration between the office and terminal pages. */
export const MOBILE_VIEW_TRANSITION_MS = 300;
/** Width of the screen-edge strips that arm the view-switch swipe: right
 *  edge in office view (swipe left → terminal), left edge in terminal view
 *  (swipe right → office). */
export const MOBILE_EDGE_SWIPE_ZONE_PX = 24;
/** Horizontal movement that claims an armed edge touch as a view swipe; it
 *  must also dominate the vertical axis, or the touch is handed back. */
export const MOBILE_EDGE_SWIPE_SLOP_PX = 8;
/** Fraction of the page width past which a released swipe commits. */
export const MOBILE_EDGE_SWIPE_COMMIT_RATIO = 0.35;
/** Release velocity (px/ms) that commits a swipe regardless of distance. */
export const MOBILE_EDGE_SWIPE_COMMIT_VELOCITY = 0.3;
/** Weight of the newest sample in the swipe's smoothed release velocity
 *  (the rest carries over from the previous estimate). */
export const MOBILE_EDGE_SWIPE_VELOCITY_WEIGHT = 0.8;
/** Slightly smaller than the desktop 13px: a 390px phone fits ~46 columns at
 *  13px but ~50 at 12px, and Claude Code's TUI degrades below ~45 columns. */
export const MOBILE_TERMINAL_FONT_SIZE_PX = 12;

// ── Touch input (every surface) ──────────────────────────────
/** Tap slop shared by every touch surface (withinTapSlop): a finger that
 *  travels less than this from where it landed is still a tap; beyond it the
 *  gesture becomes that surface's drag (pan, scroll, reorder). */
export const TOUCH_TAP_MAX_MOVE_PX = 10;
/** A press longer than this is not a tap even if the finger never moved. */
export const TOUCH_TAP_MAX_DURATION_MS = 350;

// ── Terminal touch (touchGesture.ts, selectionOverlay.ts, flowCopy.ts) ──
/** Hold a finger within the tap slop for this long on the terminal to start
 *  text selection instead of scrolling: the word under the finger is
 *  selected, and dragging then extends the selection cell by cell. */
export const TERMINAL_LONG_PRESS_MS = 500;
/** Vertical gap between the selection's top row and the floating copy pill
 *  hovering above it (clears the start handle's knob). */
export const TERMINAL_COPY_PILL_GAP_PX = 56;
/** The copy pill's center stays at least this far from the pane's left and
 *  right edges — or half its measured width, when that is more — so it is
 *  never clipped. */
export const TERMINAL_COPY_PILL_EDGE_INSET_X_PX = 44;
/** The copy pill's top stays at least this far above the pane's bottom edge
 *  (its own height plus a margin). */
export const TERMINAL_COPY_PILL_BOTTOM_CLEARANCE_PX = 48;
/** The copy pill's top never goes above this; a pill that would (selection
 *  near the top of the pane) drops below the selection instead. */
export const TERMINAL_COPY_PILL_MIN_TOP_PX = 4;
/** Gap below the selection's last row when the pill drops beneath it (clears
 *  the end handle's knob). */
export const TERMINAL_COPY_PILL_BELOW_OFFSET_PX = 16;
/** Width of a selection handle's touch strip, centered on the selection edge.
 *  Feeds the `.terminal-sel-handle` CSS through --sel-handle-w. */
export const TERMINAL_SEL_HANDLE_WIDTH_PX = 24;
/** Side of a selection handle's square knob (above the start bar, below the
 *  end bar). Feeds the `.terminal-sel-handle` CSS through --sel-knob. */
export const TERMINAL_SEL_HANDLE_KNOB_PX = 12;
/** Copy-flowing (flowCopy.ts) judges "the next word would not have fit on
 *  the row above" against `cols` minus this: Claude Code wraps prose a few
 *  columns short of the terminal width (its own gutters). Too small and real
 *  soft wraps stay broken; too large and short deliberate lines get joined. */
export const TERMINAL_COPY_WRAP_SLACK_COLS = 4;
/** Flick decay after a terminal touch-scroll release, applied per millisecond
 *  of frame time (0.998 ≈ iOS UIScrollView's normal deceleration rate). */
export const TERMINAL_FLICK_DECAY_PER_MS = 0.998;
/** Release velocity (px/ms) below which no flick starts and at which a
 *  running flick stops. */
export const TERMINAL_FLICK_MIN_VELOCITY_PX_PER_MS = 0.05;
/** Exponential smoothing of the touch-scroll velocity: weight of the newest
 *  move's sample (the running value keeps the rest). The release velocity
 *  comes from the last move event, which is noisy on its own. */
export const TERMINAL_FLICK_VELOCITY_SMOOTHING = 0.8;
/** xterm's cell-grid element: hit-testing, row height and the selection
 *  chrome all measure THIS rect (not the host, which keeps up to a row of
 *  slack below the grid after fit). */
export const XTERM_SCREEN_SELECTOR = '.xterm-screen';
/** Class of xterm's hidden input textarea — focused while typing into a
 *  terminal (see isTypingInTerminal). */
export const XTERM_HELPER_TEXTAREA_CLASS = 'xterm-helper-textarea';

// ── Mobile card bar (MobileAgentBar) ─────────────────────────
/** Holding a card motionless this long arms drag-to-reorder in the mobile bar. */
export const CARD_REORDER_LONG_PRESS_MS = 400;
/** Slide duration when the desktop card row moves an agent that became
 *  active to the front (FLIP animation), in ms. */
export const CARD_ROW_REORDER_MS = 300;
/** Holding a drawer's Directory row this long opens its edit modal — the touch
 *  stand-in for the pencil, which only exists where rows can be hovered. */
export const DRAWER_EDIT_LONG_PRESS_MS = 500;
/** Finger slop for that hold: moving beyond this is a scroll, not a press. */
export const DRAWER_EDIT_LONG_PRESS_MAX_MOVE_PX = 10;
/** Gap a viewport-fitted Dropdown (the launch drawer) keeps from the top of
 *  the viewport when its content is taller than the room above its anchor. */
export const DROPDOWN_VIEWPORT_MARGIN_PX = 8;
/** localStorage key for the mobile bar's custom card order (per device — a
 *  presentation preference, deliberately not synced through the server). */
export const MOBILE_CARD_ORDER_STORAGE_KEY = 'pixel-agents.mobileCardOrder';
/** Breathing room kept between a card and the scroller edge when the bar
 *  auto-scrolls the focused agent's card into view. */
export const CARD_SCROLL_INTO_VIEW_MARGIN_PX = 8;

// ── Mobile key bar (MobileKeyBar) ────────────────────────────
/** Arrow-key byte sequences the trackpad key writes to the PTY. */
export const TERMINAL_SEQ_ARROW_UP = '\x1b[A';
export const TERMINAL_SEQ_ARROW_DOWN = '\x1b[B';
export const TERMINAL_SEQ_ARROW_RIGHT = '\x1b[C';
export const TERMINAL_SEQ_ARROW_LEFT = '\x1b[D';
/** Accessory keys shown above the iOS keyboard in terminal view — the keys a
 *  Claude Code TUI needs that the software keyboard lacks. `sequence` is the
 *  raw bytes written to the PTY: shift+tab is CSI Z (back-tab). */
export const MOBILE_KEY_BAR_KEYS: ReadonlyArray<{
  label: string;
  /** Byte sequence a tap writes to the PTY. Absent on the trackpad key — a
   *  plain tap there deliberately does nothing. */
  sequence?: string;
  /** Press-hold-slide emits arrow keys with the finger in all four
   *  directions, echoing the iOS space-bar trackpad (whose real caret
   *  gesture can't reach xterm — its textarea must stay empty for input
   *  diffing). Drives Claude Code's TUI menus (/resume, /model) and the
   *  input-line cursor; the iOS keyboard has no arrows of its own. */
  trackpad?: boolean;
}> = [
  { label: '/', sequence: '/' },
  { label: 'shift+tab', sequence: '\x1b[Z' },
  { label: 'esc', sequence: '\x1b' },
  { label: '✜', trackpad: true },
  // Line break without submitting: Claude Code's backslash+Enter escape —
  // its universal form (shift+enter needs a /terminal-setup rebind that
  // can't exist on a phone keyboard).
  { label: '↵', sequence: '\\\r' },
];
/** Finger travel per emitted arrow while sliding on the trackpad key. */
export const MOBILE_TRACKPAD_STEP_PX = 16;
/** The paste key's prompt where script can't read the clipboard (plain-http
 *  origins): the user pastes into the native field instead. */
export const MOBILE_PASTE_PROMPT = 'Paste into the terminal:';
/** visualViewport.height within this many px of innerHeight = nothing to
 *  clamp (the two disagree by sub-pixel rounding on some devices). */
export const VISUAL_VIEWPORT_FULL_EPSILON_PX = 1;
/** The visual viewport this far below the tallest seen at the current width
 *  (with an editable focused) = the software keyboard is up. Well above an
 *  address bar collapsing (~56 px), well below any on-screen keyboard. */
export const KEYBOARD_MIN_HEIGHT_PX = 150;

// ── Usage meter ──────────────────────────────────────────────
/** How often the meter re-checks whether its window has reset. */
export const USAGE_EXPIRY_CHECK_MS = 30_000;
/** Length of Claude's "current session" rate-limit window, in hours. The meter
 *  fills a ring over the hours before the last; the last hour runs inside the bar. */
export const USAGE_SESSION_HOURS = 5;
/** Session ring hue when empty (green) and just before full (red); the fill
 *  slides between them as the first hours pass. */
export const USAGE_RING_START_HUE = 120;
export const USAGE_RING_END_HUE = 0;
/** Session ring colour for a hue on the green → red slide. */
export const usageRingColor = (hue: number): string => `hsl(${hue}, 75%, 55%)`;

// ── Read-only office ────────────────────────────────────────
/** Tooltip on every control a view-only page shows disabled (opened without the server token). */
export const READ_ONLY_CONTROL_HINT =
  'View only: open the full link the server printed (the one ending in ?token=…) to use this.';

// ── Work start ──────────────────────────────────────────────
/** How often an agent working at a pairing seat or on its phone looks for a
 *  better spot (a computer that came free, then a pairing seat). */
export const WORK_SPOT_RECHECK_SEC = 3.0;
/** A pairing seat sits within this many tiles (Manhattan) of a computer seat. */
export const PAIR_SEAT_MAX_DIST = 2;
/** Phone ("vibe coding") overlay drawn on a working agent's walk/stand sprite. */
export const PHONE_CASE_COLOR = '#1b1b24';
/** Light rim drawn around the phone so it stands out on dark clothes. */
export const PHONE_OUTLINE_COLOR = '#f2f2ff';
export const PHONE_SCREEN_COLOR = '#7fe0ff';
export const PHONE_SCREEN_ALT_COLOR = '#d4f8ff';
/** Hand colour under the phone when the sprite has no skin pixel to sample. */
export const PHONE_HAND_FALLBACK_COLOR = '#e9a384';
/** Candidate phone spots tried (best first) before vibe coding where it stands. */
export const PHONE_SPOT_MAX_ATTEMPTS = 8;
/** Phone-spot scoring (lower wins; tile distance adds 1 per tile): standing
 *  away from any desk, and each occupied neighbouring tile, cost this much. */
export const PHONE_SCORE_AWAY_FROM_DESK = 200;
export const PHONE_SCORE_PER_NEIGHBOUR = 300;

// ── Table tennis ────────────────────────────────────────────
/** Furniture type that hosts a 1v1 game (matched against the catalog type). */
export const TABLE_TENNIS_TYPE_PATTERN = /TABLE_TENNIS/i;
/** A resting agent that finds an empty table waits this long for an opponent. */
export const TABLE_TENNIS_WAIT_MAX_SEC = 30;
/** Chance a bored agent walks to a table with nobody waiting (it then waits). */
export const TABLE_TENNIS_START_CHANCE = 0.7;
/** A game is won at this many points, by at least this lead. */
export const TABLE_TENNIS_WIN_POINTS = 11;
export const TABLE_TENNIS_WIN_BY = 2;
/** Each player serves this many points in a row (one each from deuce). */
export const TABLE_TENNIS_SERVES_PER_TURN = 2;
/** A point's rally lasts a random number of table crossings in this range. */
export const TABLE_TENNIS_RALLY_MIN_HITS = 1;
export const TABLE_TENNIS_RALLY_MAX_HITS = 8;
/** Breather between points (ball out of play), and after the winning point. */
export const TABLE_TENNIS_POINT_PAUSE_SEC = 1.2;
export const TABLE_TENNIS_GAME_OVER_PAUSE_SEC = 3;
/** Scoreboard above the net: sprite-pixel font size and how far above the
 *  table's sprite top it floats. */
export const TABLE_TENNIS_SCORE_FONT_PX = 6;
export const TABLE_TENNIS_SCORE_LIFT_PX = 5;
export const TABLE_TENNIS_SCORE_COLOR = '#ffffff';
export const TABLE_TENNIS_SCORE_WIN_COLOR = '#ffd84a';
export const TABLE_TENNIS_SCORE_BG_COLOR = '#267a54';
export const TABLE_TENNIS_SCORE_BORDER_COLOR = '#ecf0ec';
/** A player swings while the ball is within this fraction of the table of it. */
export const TABLE_TENNIS_SWING_NEAR = 0.18;
/** Seconds for the ball to cross the table once. */
export const TABLE_TENNIS_BALL_CROSS_SEC = 0.9;
/** Ball height at the paddle, in sprite pixels above the table surface. */
export const TABLE_TENNIS_BALL_HIT_HEIGHT_PX = 4;
/** Extra lift of the ball's arc before / after it bounces on the far half. */
export const TABLE_TENNIS_BALL_ARC_PX = 7;
export const TABLE_TENNIS_BALL_REBOUND_PX = 3;
/** Where along its flight (0 = hit, 1 = opponent's paddle) the ball bounces. */
export const TABLE_TENNIS_BALL_BOUNCE_AT = 0.65;
/** Ball size in sprite pixels. */
export const TABLE_TENNIS_BALL_SIZE_PX = 2;
/** Ball colour (canvas draw). */
export const TABLE_TENNIS_BALL_COLOR = '#f4f4f4';
export const TABLE_TENNIS_BALL_SHADOW_COLOR = 'rgba(0, 0, 0, 0.35)';
/** Paddle colours: rubber face, its darker rim, wooden handle. */
export const TABLE_TENNIS_PADDLE_COLOR = '#d23a3a';
export const TABLE_TENNIS_PADDLE_RIM_COLOR = '#8e2026';
export const TABLE_TENNIS_PADDLE_HANDLE_COLOR = '#9a6a35';

// ── Day/night sky (the space around and behind the office layout) ──────────

/** Sky keyframes across one real clock hour. `at` is the fraction of the hour
 *  (0 = :00, 1 = the next :00); colours blend linearly between neighbours and
 *  the last keyframe equals the first so the cycle loops with no jump. The
 *  day is a golden half hour: dawn opens it over :00–:03, night sweeps in over
 *  :30–:33 and holds until the hour turns. */
export const SKY_KEYFRAMES: ReadonlyArray<{ at: number; top: string; bottom: string }> = [
  { at: 0, top: '#c2543e', bottom: '#f2a050' },
  { at: 0.05, top: '#e2683c', bottom: '#f7b65a' },
  { at: 0.5, top: '#e2683c', bottom: '#f7b65a' },
  { at: 0.55, top: '#c2543e', bottom: '#f2a050' },
  { at: 1, top: '#c2543e', bottom: '#f2a050' },
];
/** The sun sets at this fraction, as dusk finishes closing in round it. */
export const SKY_SUN_SET_AT = 0.55;
/** The sun starts rising at this fraction: the top of the hour, as dawn begins. */
export const SKY_SUN_RISE_AT = 0;
/** The moon rises at this fraction, as night starts, and sets at the end of the hour. */
export const SKY_MOON_RISE_AT = 0.5;
/** Night closes in over [in0, in1] (dusk, :30–:33) and opens over [out0, out1] (dawn, :00–:03). */
export const SKY_STAR_FADE = { in0: 0.5, in1: 0.55, out0: 0, out1: 0.05 } as const;
/** Clouds and birds are gone by dusk; they start thinning this long (hour fraction) before it. */
export const SKY_DAY_LIFE_FADE = 0.08;
export const SKY_STAR_COUNT = 48;
/** Height of one gradient band, in sprite pixels (gives the sky a stepped, pixel look). */
export const SKY_BAND_SPRITE_PX = 4;
/** Sun/moon radius in sprite pixels. */
export const SKY_BODY_RADIUS_SPRITE_PX = 16;
export const SKY_SUN_COLOR = '#ffe066';
export const SKY_SUN_SETTING_COLOR = '#ff8a3d';
export const SKY_MOON_COLOR = '#e8e8f4';
export const SKY_MOON_CRATER_COLOR = '#b8b8d0';
export const SKY_STAR_COLOR = '#ffffff';
/** Twinkle period range in seconds. */
export const SKY_TWINKLE_SEC = 3;
/** As big as the first ring of rays round the sun at the default view size, and
 *  in sprite pixels so it grows and shrinks with the zoom; capped to a share of
 *  the canvas on a very small screen. */
export const SKY_MOON_RADIUS_SPRITE_PX = 45;
/** The moon's arc is laid out as if it had this radius, whatever size it is drawn. */
export const SKY_MOON_TRACK_RADIUS_SPRITE_PX = 16;
export const SKY_MOON_MAX_CANVAS_SHARE = 0.3;
/** The radius the moon's craters and patches were drawn for. */
export const SKY_MOON_DESIGN_RADIUS = 16;
/** Daytime fun: drifting clouds and flapping birds. */
export const SKY_CLOUD_COLOR = '#f4f8fd';
export const SKY_CLOUD_SHADE_COLOR = '#d4e6f6';
export const SKY_BIRD_COLOR = '#1f2238';
export const SKY_CLOUD_COUNT = 6;
/** Seconds a cloud / bird takes to cross the canvas (clouds vary per cloud, around this). */
export const SKY_CLOUD_CROSS_SEC = 160;
export const SKY_BIRD_COUNT = 8;
export const SKY_BIRD_CROSS_SEC = 40;
/** Seconds per wing flap. */
export const SKY_BIRD_FLAP_SEC = 0.3;
/** Starry-Night night sky: swirling bands and big glowing stars with halos. */
/** Brushstroke palette for the night sky, darkest to palest (strokes near a spiral's core run paler). */
export const SKY_SWIRL_COLORS = [
  '#0f2260',
  '#1b3a8c',
  '#2a58b8',
  '#4a7ed0',
  '#7fa8e0',
  '#c8e0f0',
] as const;
export const SKY_NIGHT_BASE_COLOR = '#173a8a';
/** The pale band of cloud rolling through the lower sky. */
export const SKY_NIGHT_BAND_COLOR = '#cfe6ee';
/** The two spirals: centre (fractions of the canvas), reach (share of the smaller side). */
export const SKY_VORTICES = [
  { x: 0.46, y: 0.36, r: 0.24 },
  { x: 0.74, y: 0.52, r: 0.13 },
] as const;
/** Canvas device pixels per brushstroke, in sprite-pixel area (lower = denser). */
export const SKY_STROKE_AREA_SPRITE_PX = 30;
export const SKY_STROKE_MAX = 14000;
/** The two looks of the night-sky brushstrokes (a tap on the moon switches): a hairline one sprite
 *  pixel thick advancing one pixel a step (stays unbroken), and the original 3x2 blocks stepping 2. */
export const SKY_STROKE_STYLES = {
  thin: { w: 1, h: 1, step: 1 },
  thick: { w: 3, h: 2, step: 2 },
} as const;
export type SkyStrokeStyle = keyof typeof SKY_STROKE_STYLES;
/** The big stars, placed by hand: x across the canvas, y as a share of the sky above the
 *  skyline, size in sprite pixels (the star's outer rings reach 2 x size + 2). */
export const SKY_BIG_STARS = [
  { x: 0.07, y: 0.3, size: 5 },
  { x: 0.17, y: 0.66, size: 4 },
  { x: 0.27, y: 0.14, size: 6 },
  { x: 0.4, y: 0.5, size: 4 },
  { x: 0.5, y: 0.16, size: 5 },
  { x: 0.63, y: 0.6, size: 6 },
  { x: 0.74, y: 0.2, size: 4 },
  { x: 0.85, y: 0.46, size: 5 },
  { x: 0.94, y: 0.12, size: 6 },
] as const;
/** Star, from the middle out: orange heart, yellow body, pale glow, then rings of dashes. */
export const SKY_BIG_STAR_HEART_COLOR = '#f0a02c';
export const SKY_BIG_STAR_BODY_COLOR = '#ffe77a';
export const SKY_BIG_STAR_PALE_COLOR = '#fff7c8';
export const SKY_BIG_STAR_DASH_COLORS = ['#fdf3b0', '#ffffff', '#cfe4f6'] as const;
/** (The sun itself is not drawn as a disc: the warm glow of dabs marks where it is.) */
/** Realistic moon: shaded sphere with maria (dark patches) and craters. */
export const SKY_MOON_SHADE_COLOR = '#a9aac4';
export const SKY_MOON_MARE_COLOR = '#c4c5da';
export const SKY_MOON_GLOW_COLOR = '#b8c4ff';
/** Pixel-art day and sunset: flat stepped rings of colour around a cream sun (outermost first). */
export const SKY_RING_COLORS = [
  '#ee8244',
  '#f2964a',
  '#f5aa52',
  '#f8c060',
  '#fad478',
  '#fce698',
] as const;
export const SKY_SUN_CORE_COLOR = '#fff8cc';
/** Outer ring radius as a share of the canvas's smaller side: at midday, and added by sunset. */
export const SKY_RING_SHARE = 0.2;
export const SKY_RING_SUNSET_SHARE = 0.7;
/** How strongly the rings show at midday (they are fully opaque at sunset). */
export const SKY_RING_DAY_ALPHA = 0.45;
/** Cloud streaks at sunset: purple body, with a warm lit underside. */
export const SKY_CLOUD_SUNSET_COLOR = '#a85a6e';
export const SKY_CLOUD_SUNSET_LIT_COLOR = '#7a4a78';
/** Night sweeps in from the right behind a dithered edge this many sprite pixels wide. */
export const SKY_WIPE_BAND_SPRITE_PX = 48;
/** Skyline silhouettes standing on the office's top edge, and the ground around the office. */
export const SKY_SKYLINE_DAY_COLOR = '#24382e';
export const SKY_SKYLINE_NIGHT_COLOR = '#0d1226';
export const SKY_HILL_DAY_COLOR = '#3d6b52';
export const SKY_HILL_NIGHT_COLOR = '#1b2f6e';
export const SKY_WINDOW_COLOR = '#ffd84a';
/** How far above the top row of tiles the skyline stands (the wall face rises this much). */
export const SKY_HORIZON_LIFT_SPRITE_PX = 14;
/** Opaque fill used only to cut masks (its colour never shows). */
export const SKY_MASK_COLOR = '#000000';
/** The land round the office: banded ground, trees in the side gaps. */
export const SKY_GROUND_DAY_COLORS = ['#5a3230', '#663a33'] as const;
export const SKY_GROUND_NIGHT_COLORS = ['#182654', '#1d2e62'] as const;
export const SKY_TREE_DAY_COLORS = { dark: '#15131a', lit: '#6a3c2c', trunk: '#0f0d12' } as const;
export const SKY_TREE_NIGHT_COLORS = { dark: '#080c1c', lit: '#24407e', trunk: '#060814' } as const;
/** Sprite-pixel spacing of the trees in the side gaps, and the narrowest gap that gets any. */
export const SKY_TREE_SPACING_SPRITE_PX = 26;
export const SKY_TREE_MIN_GAP_SPRITE_PX = 16;
/** The night sky's brushstrokes flow: this many frames, looping in this many seconds. */
export const SKY_NIGHT_FRAMES = 12;
export const SKY_NIGHT_LOOP_SEC = 3;
/** Sky fast-forward button: a whole hour of sky per this many seconds while held. */
export const SKY_FF_CYCLE_SEC = 6;
/** Letting go runs the sky back to the real time this many times faster. */
export const SKY_FF_REWIND_SPEEDUP = 2;
/** A press shorter than this is a tap: it plays one full cycle forward. */
export const SKY_FF_TAP_MS = 300;
/** The sky button's sprites: a hot air balloon by day, the ISS by night. One
 *  character per sprite pixel, coloured from the palette; `.` is clear. */
export const SKY_BUTTON_PALETTE: Readonly<Record<string, string>> = {
  r: '#d8433a',
  y: '#f6c244',
  w: '#fdf3d8',
  k: '#3a2a24',
  b: '#8a5a34',
  p: '#3f6fd0',
  g: '#9cc0f4',
  s: '#c9ced8',
  m: '#f2f4f8',
};
export const SKY_BUTTON_BALLOON = [
  '...ywwwy...',
  '..yywwwyy..',
  '.ryywwwyyr.',
  'rryywwwyyrr',
  'rryywwwyyrr',
  'rryywwwyyrr',
  'rryywwwyyrr',
  '.ryywwwyyr.',
  '..yywwwyy..',
  '...ywwwy...',
  '....www....',
  '...k...k...',
  '....k.k....',
  '....bbb....',
  '....bbb....',
] as const;
export const SKY_BUTTON_ISS = [
  'pp.pp.......pp.pp',
  'pg.gp.......pg.gp',
  'pp.pp...m...pp.pp',
  'ssssssssmssssssss',
  'pp.pp..mmm..pp.pp',
  'pg.gp..msm..pg.gp',
  'pp.pp...m...pp.pp',
] as const;
/** CSS pixels per sprite pixel of the sky button, and how often it checks day or night. */
export const SKY_BUTTON_SCALE = 4;
export const SKY_BUTTON_CHECK_MS = 250;

// ── Hourly music (YouTube IFrame player synced to the :00 clock) ──
/** localStorage keys (per device): the track link and whether music is on. */
export const MUSIC_URL_STORAGE_KEY = 'pixel-agents.musicUrl';
export const MUSIC_ON_STORAGE_KEY = 'pixel-agents.musicOn';
/** Window event the Settings field fires after saving a new link. */
export const MUSIC_URL_CHANGED_EVENT = 'pixel-agents:music-url-changed';
export const YOUTUBE_IFRAME_API_SRC = 'https://www.youtube.com/iframe_api';
/** How often the player is compared with the clock, and the drift that triggers a seek. */
export const MUSIC_RESYNC_CHECK_MS = 5000;
export const MUSIC_DRIFT_TOLERANCE_SEC = 1.5;
/** Seconds of lead added when seeking, to cover the seek's own latency. */
export const MUSIC_SEEK_LEAD_SEC = 0.3;
/** Music button note sprite ('x' = filled) and its CSS pixels per sprite pixel. */
export const MUSIC_BUTTON_NOTE = [
  '...xxxx',
  '...xxxx',
  '...x..x',
  '...x..x',
  '...x..x',
  '.xxx.xxx',
  'xxxx.xxxx',
  '.xx...xx',
] as const;
export const MUSIC_BUTTON_SCALE = 3;

// ── Pass / fail reactions ───────────────────────────────────
/** How long a "tests passed" cheer plays (body animation + emote). */
export const REACTION_PASS_DURATION_SEC = 2.2;
/** How long a "command failed" slump plays. */
export const REACTION_FAIL_DURATION_SEC = 2.8;
/** The cheering body animation (arms up, hopping) runs for this part of a pass. */
export const REACTION_CHEER_BODY_SEC = 1.6;
/** One hop = one arm swing; seconds per hop. */
export const REACTION_HOP_PERIOD_SEC = 0.3;
/** Hop height in sprite pixels. */
export const REACTION_HOP_HEIGHT_PX = 4;
/** Raised arms: sprite padding either side, arm length in steps, and the
 *  shoulder row below the head's top row. */
export const REACTION_ARM_PAD_PX = 6;
export const REACTION_ARM_STEPS = 9;
export const REACTION_SHOULDER_BELOW_HEAD_PX = 15;
/** Slump: the head sinks this many sprite pixels over the shoulders. */
export const REACTION_SLUMP_HEAD_DROP_PX = 2;
export const REACTION_HEAD_ROWS = 10;
/** Slump shake: first seconds of a failure, sprite pixels each way, flips per period. */
export const REACTION_SHAKE_SEC = 0.6;
export const REACTION_SHAKE_PERIOD_SEC = 0.08;
/** Confetti: pieces per burst, burst times, and physics (sprite px, seconds). */
export const REACTION_CONFETTI_COUNT = 16;
export const REACTION_CONFETTI_BURSTS_SEC = [0, 0.5];
export const REACTION_CONFETTI_LIFE_SEC = 1.2;
export const REACTION_CONFETTI_SPEED_PX = 30;
export const REACTION_CONFETTI_GRAVITY_PX = 60;
/** Emote placement above the character's head, sprite pixels. */
export const REACTION_EMOTE_RISE_PX = 4;
export const REACTION_BADGE_POP_SEC = 0.25;
export const REACTION_BADGE_FADE_SEC = 0.4;
/** Rain cloud over a failure: appears after a beat; drops fall in a loop. */
export const REACTION_CLOUD_DELAY_SEC = 0.25;
export const REACTION_DROP_PERIOD_SEC = 0.45;
export const REACTION_DROP_FALL_PX = 9;
/** Draw order: emotes sort above everything near the character. */
export const REACTION_EMOTE_Z_OFFSET = 500;
export const REACTION_CONFETTI_COLORS = ['#ff5c7a', '#ffd23f', '#3ddc84', '#4cc9f0', '#c77dff'];
export const REACTION_OUTLINE_FALLBACK_COLOR = '#1b1b24';
export const REACTION_BADGE_PASS_COLOR = '#2fbf71';
export const REACTION_BADGE_FAIL_COLOR = '#e5484d';
export const REACTION_BADGE_RIM_COLOR = '#1b1b24';
export const REACTION_BADGE_GLYPH_COLOR = '#ffffff';
export const REACTION_CLOUD_COLOR = '#9aa3b8';
export const REACTION_CLOUD_SHADE_COLOR = '#5b6275';
export const REACTION_DROP_COLOR = '#6cb8ff';
/** Opacity of an agent's activity label while its pass/fail emote plays above it. */
export const REACTION_LABEL_OPACITY = 0.12;

/** Task flyers: one plane (day) or satellite (night) per task, flying left to right. */
export const SKY_TASK_STAGES = [
  'designing',
  'coding',
  'testing',
  'plan_ready',
  'needs_decision',
  'ready',
  'in_review',
  'done',
] as const;
/** Plane body colour per stage, in stage order. */
export const SKY_TASK_COLORS = [
  '#9aa0b4',
  '#f2c14e',
  '#f08a3c',
  '#6aa8e8',
  '#ffd23f',
  '#6fd36f',
  '#b48ae8',
  '#ffffff',
];
export const SKY_TASK_TRAIL_COLOR = '#ffffff';
export const SKY_TASK_WING_COLOR = '#2c3350';
export const SKY_TASK_PANEL_COLOR = '#4a6fb5';
export const SKY_TASK_BLINK_ON = '#ff4a4a';
export const SKY_TASK_BLINK_ALT = '#7dff9a';
/** Seconds a flyer takes to cross its stage's lane (plan is slowest, merged fastest). */
export const SKY_TASK_CROSS_SEC_SLOWEST = 36;
export const SKY_TASK_CROSS_SEC_FASTEST = 14;
/** Contrail length in sprite pixels. */
export const SKY_TASK_BLINK_SEC = 0.6;
/** Planes are drawn this many times the sky's pixel size: 1 makes them as big as the birds. */
export const SKY_TASK_PLANE_SCALE = 1;
/** Sprite pixels between a flyer's tail and where its trail begins (measured from the flyer's middle). */
export const SKY_TASK_PLANE_TRAIL_GAP = 9;
export const SKY_TASK_SAT_TRAIL_GAP = 6;
/** Parallel orbits, one per flying status (designing, coding, testing), all the same arc, each shifted up by a gap (fractions of the skyline height). The other statuses wait on the airfield instead. */
export const SKY_TASK_TRACKS = 3;
/** The statuses that fly an orbit, low to high. The other statuses wait on the airfield. */
export const SKY_TASK_FLYING_STAGES = ['designing', 'coding', 'testing'] as const;
export const SKY_TASK_GROUND = 0.97;
export const SKY_TASK_TRACK_GAP = 0.09;
/** Flyers on one orbit stay at least this many sprite pixels apart along it (a plane is 14 long). */
export const SKY_TASK_MIN_GAP = 26;
/** A flyer pushed by a neighbour drifts at most this many sprite pixels per second off its normal speed. */
export const SKY_TASK_NUDGE_PX_PER_SEC = 5;
/** A take-off waits on the ground until its joining point is clear, checked in these steps. */
export const SKY_TASK_JOIN_STEP_SEC = 0.25;
export const SKY_TASK_RISE = 0.42;

// ── Airfield at the right of the sky ────────────────────────────────────────
// Plan tasks park in the left lot, take off from the left runway and join their
// orbit; in review tasks come off the orbit onto the right runway and park
// in the right lot. Sizes are in sprite pixels unless noted.
export const SKY_AIRFIELD_WIDTH = 54;
/** At the biggest office sizes the gap right of it is too narrow for the field, so a strip stands
 *  there instead: this wide a lot, this many sprite pixels from the office border. */
export const SKY_AIRFIELD_STRIP_LOT_W = 11;
export const SKY_AIRFIELD_STRIP_GAP = 2;
export const SKY_AIRFIELD_HEIGHT_SHARE = 0.55;
export const SKY_AIRFIELD_HEIGHT_MIN = 30;
export const SKY_AIRFIELD_HEIGHT_MAX = 60;
/** In the woods right of the office (when the gap there is wide enough) the field is long:
 *  it starts this far below the skyline and takes this share of the height below it. */
export const SKY_AIRFIELD_WOODS_TOP = 18;
export const SKY_AIRFIELD_WOODS_HEIGHT_SHARE = 0.58;
/** Sprite pixels between the trees standing down each side of the field. */
export const SKY_AIRFIELD_TREE_STEP = 20;
export const SKY_AIRFIELD_WOODS_HEIGHT_MAX = 130;
/** Gap between the airfield and the right edge of the sky. */
export const SKY_AIRFIELD_MARGIN = 3;
/** Gap between the village and the airfield. */
export const SKY_AIRFIELD_VILLAGE_GAP = 8;
/** Orbits lift to this far above the airfield, easing in over `SKY_AIRFIELD_LIFT_BLEND` before it. */
export const SKY_AIRFIELD_CLEARANCE = 5;
export const SKY_AIRFIELD_LIFT_BLEND = 60;
/** Column layout, left to right: terminal, lot, taxi gap, runway, middle, runway, taxi gap, lot, terminal. */
export const SKY_AIRFIELD_TERMINAL_W = 1;
export const SKY_AIRFIELD_LOT_W = 15;
export const SKY_AIRFIELD_TAXI_W = 1;
export const SKY_AIRFIELD_RUNWAY_W = 9;
/** The taxiway along the bottom: rows from the bottom edge. */
export const SKY_AIRFIELD_TAXI_ROW_FROM_BOTTOM = 6;
export const SKY_AIRFIELD_TAXI_BAND_H = 6;
/** Parked planes are this far apart (a plane is 9 long). */
export const SKY_AIRFIELD_SLOT_PITCH = 11;
/** Seconds each leg of a take-off and a landing takes. */
export const SKY_AIRFIELD_TAKEOFF_TAXI_SEC = [0.5, 0.7, 0.6] as const;
export const SKY_AIRFIELD_TAKEOFF_ROLL_SEC = 1.8;
export const SKY_AIRFIELD_CLIMB_SEC = 3.5;
/** How far along the orbit (sprite pixels) the climb joins it, past the runway's end. */
export const SKY_AIRFIELD_CLIMB_DX = 16;
export const SKY_AIRFIELD_GLIDE_SEC = 3.5;
/** Between the runway and the track the plane folds its wings to the side view from
 *  `FOLD_FROM` of the way (its size grows to the sky plane's, which is unchanged), and the
 *  sky flyer takes over from `FADE_FROM`. */
export const SKY_AIRFIELD_FOLD_FROM = 0.45;
export const SKY_AIRFIELD_FADE_FROM = 0.72;
/** The glide starts this many sprite pixels before the landing runway's end. */
export const SKY_AIRFIELD_GLIDE_DX = 20;
export const SKY_AIRFIELD_LANDING_ROLL_SEC = 1.6;
export const SKY_AIRFIELD_LANDING_TAXI_SEC = [0.6, 0.7, 0.5] as const;
/** A tests task parks in the left lot, so it taxies the whole way across the field from the landing runway. */
export const SKY_AIRFIELD_LANDING_CROSS_SEC = 2.2;
/** Night: tasks leave and return on rockets from the lots instead of planes down the runways.
 *  The rocket stands on its pad, lights up, climbs straight up and shrinks into the distance
 *  (the field is close, the tracks far away), pitching over onto its track as the satellite
 *  takes over; a landing is the same flight backwards, ending in a burn onto the pad. */
export const SKY_ROCKET_HOLD_SEC = 1;
export const SKY_ROCKET_RISE_SEC = 4.6;
export const SKY_ROCKET_DESCENT_SEC = 4.6;
export const SKY_ROCKET_SETTLE_SEC = 0.8;
/** The rocket's size when it reaches the track, as a share of its size on the pad. */
export const SKY_ROCKET_FAR_SCALE = 0.3;
/** Sprite pixels the track point lies along the orbit from the lot (past it leaving, before it landing). */
export const SKY_ROCKET_TRACK_DX = 8;
/** Share of the flight after which the rocket pitches over, and after which the satellite fades in. */
export const SKY_ROCKET_PITCH_FROM = 0.55;
export const SKY_ROCKET_FADE_FROM = 0.72;
/** A flight is a rocket's when the sky is at least this dark as it starts. */
export const SKY_ROCKET_NIGHT_MIN = 0.5;
export const SKY_ROCKET_BODY_COLOR = '#f2f2f2';
export const SKY_ROCKET_DARK_COLOR = '#1c1c24';
export const SKY_ROCKET_LEG_COLOR = '#5d6070';
export const SKY_ROCKET_FLAME_COLORS = ['#ffd84a', '#ff8a2a'] as const;
export const SKY_ROCKET_DUST_COLOR = '#aab0bd';
/** Day / night colours. */
export const SKY_AIRFIELD_GRASS_COLORS = [
  { day: '#5a9a3f', night: '#1a3a2a' },
  { day: '#4c8636', night: '#142e22' },
] as const;
export const SKY_AIRFIELD_TARMAC = { day: '#7a7d86', night: '#2a2d3c' } as const;
export const SKY_AIRFIELD_RUNWAY = { day: '#3b3d46', night: '#14151e' } as const;
export const SKY_AIRFIELD_MARKING = { day: '#f2f2f2', night: '#9aa0c0' } as const;
export const SKY_AIRFIELD_TAXI_LINE = { day: '#e8c02e', night: '#8a7420' } as const;
export const SKY_AIRFIELD_TERMINAL = { day: '#c9ccd6', night: '#4a4f68' } as const;
export const SKY_AIRFIELD_TERMINAL_EDGE = { day: '#8a8ea0', night: '#2c3048' } as const;
export const SKY_AIRFIELD_LIGHT_COLOR = '#ffd84a';
export const SKY_AIRFIELD_PLANE_WING_COLOR = '#e8eaf2';
/**
 * Siren beacons beside a parked plane (or rocket): blue for plan ready, yellow for needs decision, green
 * for ready and in review. Each beacon is a rotating siren: a bright pixel sweeps across the dome
 * while the glow pulses.
 */
export const SKY_BEACON_SWEEP_RATE = 1.6;
export const SKY_BEACON_GLOW_ALPHA = 0.3;
export const SKY_BEACON_BASE_COLOR = '#1c1c24';
export const SKY_BEACON_RIM_COLOR = '#b3322a';
export const SKY_BEACON_COLORS = {
  plan_ready: { dome: '#4aa3ff', core: '#d2e8ff', glow: '#6fb8ff' },
  needs_decision: { dome: '#ffd23f', core: '#fff3b0', glow: '#ffe066' },
  ready: { dome: '#3ddc5a', core: '#c4ffd0', glow: '#4fe070' },
  in_review: { dome: '#3ddc5a', core: '#c4ffd0', glow: '#4fe070' },
} as const;
/** The "#N" pull request number under each parked plane or rocket: text colour, shadow, size in sprite pixels, gap below the bay centre. */
export const SKY_PR_NUMBER_COLOR = 'rgba(255, 255, 255, 0.95)';
export const SKY_PR_NUMBER_SHADOW_COLOR = 'rgba(10, 10, 20, 0.85)';
export const SKY_PR_NUMBER_SIZE_UNITS = 3;
export const SKY_PR_NUMBER_MIN_FONT_PX = 8;
/** Ready to merge: the number stands this far outside the field edge, if at least ROOM units remain to the sky's edge. */
export const SKY_PR_NUMBER_EDGE_GAP_UNITS = 1;
export const SKY_PR_NUMBER_ROOM_UNITS = 5;
/** With no room outside: the number's near edge, from the plane's centre (negative = to its left, away from the siren). */
export const SKY_PR_NUMBER_FREE_SIDE_UNITS = -4;
export const SKY_PR_NUMBER_OFFSET_UNITS = 6;
/** Runway lights chase along the edges at this rate (steps per second). */
export const SKY_AIRFIELD_LIGHT_RATE = 3;

// ── Merge celebration (a merged pull request, played at the sky button) ──
/** Palette of the celebration sprites; the sky button's own palette is reused for the balloon and ISS. */
export const SKY_MERGE_PALETTE: Readonly<Record<string, string>> = {
  ...SKY_BUTTON_PALETTE,
  o: '#f08a2a',
  f: '#ffd84a',
  n: '#1c1c24',
  h: '#ffffff',
};
/** The docking module (3 x 5), port end up: `s` port, `m` hull, `o` stripe, `n` thruster. */
export const SKY_MERGE_MODULE = ['.s.', 'mmm', 'mom', 'mmm', '.n.'] as const;
/** The parachute canopy (5 x 2). */
export const SKY_MERGE_CANOPY = ['.rwr.', 'rwwwr'] as const;
/** The dropped packet (2 x 2). */
export const SKY_MERGE_PACKET = ['bb', 'by'] as const;
/** The burner flame under the balloon (3 x 2), two flickering frames. */
export const SKY_MERGE_FLAME = [
  ['.f.', 'fof'],
  ['.o.', 'ofo'],
] as const;
/** The balloon's stripes, one letter per sector of its turn (a sector is a tenth of a turn). */
export const SKY_MERGE_STRIPES = 'rywyrrywyr';
/** CSS pixels per sprite pixel of the plane and rocket (the button sprites use SKY_BUTTON_SCALE). */
export const SKY_MERGE_FLYER_PX = 3;
/** Plane body colour and the rocket's stage band. */
export const SKY_MERGE_PLANE_COLOR = '#e8503a';
export const SKY_MERGE_ROCKET_BAND = '#d8433a';
/** The celebration canvas's stacking order: above the sky button (z-44). */
export const SKY_MERGE_Z_INDEX = 45;
/** Most celebrations that wait their turn when several pull requests merge at once. */
export const SKY_MERGE_QUEUE_MAX = 3;
/** Night: a rocket climbs to the ISS, drops a module that docks; the ISS folds and unfolds its panels, blinks twice, the module goes. Seconds; positions in sprite pixels from the ISS centre. */
export const SKY_MERGE_NIGHT = {
  rocketX: -26,
  rocketFromY: 70,
  releaseAt: 2.6,
  releaseY: 4,
  rocketEnd: 5,
  rocketToY: -50,
  approachSec: 1.1,
  approachY: 14,
  dockSec: 0.9,
  dockY: 6,
  foldAt: 4.9,
  foldSec: 0.8,
  foldHoldSec: 0.2,
  foldMin: 0.2,
  blinks: [
    [7.0, 7.35],
    [7.65, 8.0],
  ],
  vanishAt: 8.3,
  vanishSec: 0.6,
  total: 9.2,
} as const;
/** Day: a plane flies by the balloon and drops a packet on a parachute into the basket; the plane leaves, the burner fires, the balloon turns twice. */
export const SKY_MERGE_DAY = {
  planeY: -6.5,
  dropX: -12,
  dropAt: 2,
  exitAt: 4.4,
  planeMargin: 10,
  chuteSec: 2.6,
  chuteSideX: -9,
  chuteSideY: 3,
  chuteSideShare: 0.72,
  basketY: 5.5,
  flames: [
    [4.9, 5.5],
    [5.8, 6.6],
  ],
  liftMax: 1,
  spinAt: 6.8,
  spinSec: 3.2,
  spinTurns: 2,
  total: 10.4,
} as const;

// ── Monitor glow (PC screen tint by the agent's tool) ────────────────────────
export const MONITOR_SCREEN_TYPE_PREFIX = 'PC_FRONT_ON';
export const MONITOR_SHELL_TOOLS: ReadonlySet<string> = new Set(['Bash', 'PowerShell']);
export const MONITOR_EDIT_TOOLS: ReadonlySet<string> = new Set([
  'Edit',
  'MultiEdit',
  'Write',
  'NotebookEdit',
]);
/** Stock screen colours (lower-case #RRGGBB) → tinted ones. Reading keeps the stock green. */
export const MONITOR_GLOW_PALETTES: Record<'edit' | 'shell' | 'read', Record<string, string>> = {
  read: {},
  edit: {
    '#41604f': '#2c4a7c',
    '#4a655d': '#355584',
    '#548e61': '#4a7fcf',
    '#60c677': '#7db4ff',
  },
  shell: {
    '#41604f': '#101216',
    '#4a655d': '#171a1f',
    '#548e61': '#2a2f36',
    '#60c677': '#4a525c',
  },
};

// ── Live whiteboard ──────────────────────────────────────────
export const WHITEBOARD_FURNITURE_TYPE = 'WHITEBOARD';
/** The count's plate, as a fraction of the board's footprint. */
/** The count is drawn from a 3x5 pixel font, each lit pixel 2 wide so it reads bold. Rows of 3 bits, top first. */
export const WHITEBOARD_GLYPHS: Record<string, readonly number[]> = {
  '0': [7, 5, 5, 5, 7],
  '1': [2, 6, 2, 2, 7],
  '2': [7, 1, 7, 4, 7],
  '3': [7, 1, 7, 1, 7],
  '4': [5, 5, 7, 1, 1],
  '5': [7, 4, 7, 1, 7],
  '6': [7, 4, 7, 5, 7],
  '7': [7, 1, 1, 1, 1],
  '8': [7, 5, 7, 5, 7],
  '9': [7, 5, 7, 1, 7],
};
export const WHITEBOARD_GLYPH_W = 3;
export const WHITEBOARD_GLYPH_H = 5;
/** Each lit pixel is this many world pixels wide (bold). */
export const WHITEBOARD_GLYPH_STROKE = 2;
/** Gap between digits, and the plate's margin round the digits, in world pixels. */
export const WHITEBOARD_GLYPH_GAP = 1;
export const WHITEBOARD_PLATE_MARGIN = 1;
export const WHITEBOARD_COUNT_COLOR = '#2b6cdf';
/** The board sprite's own surface colour, so the patch that clears its scribbles under the count is invisible. */
export const WHITEBOARD_PLATE_COLOR = '#efebe8';
/** How often the open list re-reads the board, ms. */
export const WHITEBOARD_REFRESH_MS = 1000;
export const WHITEBOARD_MODAL_Z_INDEX = 52;

// ── Wall clock (the CLOCK item shows the device's local time) ──
/** The CLOCK sprite pixel the hands turn about (a face pixel, so a hand starts on it). */
export const CLOCK_PIVOT_COL = 7;
export const CLOCK_PIVOT_ROW = 16;
/** Hand lengths in sprite pixels from the pivot (the face has 3 pixels of room each way). */
export const CLOCK_HOUR_HAND_LENGTH = 2;
export const CLOCK_MINUTE_HAND_LENGTH = 3;
export const CLOCK_HAND_COLOR = '#394449';
/** The catalog type of the wall clock. */
export const CLOCK_TYPE = 'CLOCK';

/** Character ids of cloud sessions count up from here: clear of server agent ids (small), sub-agents (negative) and the greeter. */
export const CLOUD_AGENT_ID_BASE = 2_000_000;
/** Longest cloud-session title the activity label shows before it is cut. */
export const CLOUD_TITLE_MAX_CHARS = 60;
