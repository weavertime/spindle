import React, { memo, useState, useEffect, useRef, useMemo } from 'react';
import { HyperlinkModal } from './HyperlinkModal';
import type { FormatType } from '@pagent-libs/sheets-core';
import {
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Palette,
  PaintBucket,
  Grid2x2,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyCenter,
  WrapText,
  RotateCw,
  DollarSign,
  Percent,
  Hash,
  Combine,
  Link,
  Snowflake,
  ChevronDown,
  Filter,
  ArrowDownAZ,
  ArrowUpAZ,
  Minus,
  Plus,
  MessageSquare,
} from 'lucide-react';

// ============================================================================
// Toolbar Styles — shared design language with the docs toolbar
// ============================================================================

const styles = {
  // Main floating toolbar container
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '2px',
    padding: '6px 12px',
    background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 100%)',
    backdropFilter: 'blur(20px) saturate(180%)',
    WebkitBackdropFilter: 'blur(20px) saturate(180%)',
    borderRadius: '16px',
    boxShadow: `
      0 4px 6px -1px rgba(0, 0, 0, 0.05),
      0 10px 15px -3px rgba(0, 0, 0, 0.08),
      0 20px 25px -5px rgba(0, 0, 0, 0.05),
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      0 0 0 1px rgba(0, 0, 0, 0.04)
    `,
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
    position: 'relative' as const,
    zIndex: 100,
    margin: '8px auto',
    maxWidth: 'fit-content',
    flexWrap: 'wrap' as const,
  } as React.CSSProperties,

  // Button base style
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#64748b',
    cursor: 'pointer',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    position: 'relative' as const,
  } as React.CSSProperties,

  buttonHover: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: '#6366f1',
    transform: 'translateY(-1px)',
  },

  buttonActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
    color: '#6366f1',
    boxShadow: 'inset 0 1px 2px rgba(99, 102, 241, 0.15)',
  },

  buttonDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
    pointerEvents: 'none' as const,
  },

  // Divider
  divider: {
    width: 1,
    height: 24,
    background: 'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.08) 50%, transparent 100%)',
    margin: '0 6px',
    flexShrink: 0,
  } as React.CSSProperties,

  // Dropdown trigger button (with text)
  dropdownButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '4px',
    height: 32,
    padding: '0 8px 0 12px',
    border: 'none',
    borderRadius: '8px',
    backgroundColor: 'transparent',
    color: '#475569',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 500,
    fontFamily: '"Inter", sans-serif',
    transition: 'all 0.15s cubic-bezier(0.4, 0, 0.2, 1)',
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  // Dropdown menu surface
  dropdown: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    borderRadius: '12px',
    boxShadow: `
      0 4px 6px -1px rgba(0, 0, 0, 0.07),
      0 10px 15px -3px rgba(0, 0, 0, 0.1),
      0 20px 25px -5px rgba(0, 0, 0, 0.08),
      0 0 0 1px rgba(0, 0, 0, 0.05)
    `,
    zIndex: 10000,
    padding: '6px',
    minWidth: '120px',
    animation: 'sheetsToolbarFadeIn 0.15s ease-out',
  } as React.CSSProperties,

  // Dropdown item
  dropdownItem: {
    padding: '8px 12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    color: '#334155',
    transition: 'all 0.1s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } as React.CSSProperties,

  dropdownItemHover: {
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    color: '#6366f1',
  },

  dropdownItemActive: {
    backgroundColor: 'rgba(99, 102, 241, 0.12)',
    color: '#6366f1',
    fontWeight: 500,
  },

  // Section label inside a dropdown
  menuLabel: {
    padding: '6px 12px 4px',
    fontSize: '11px',
    fontWeight: 600,
    color: '#94a3b8',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  // Font size input
  fontSizeInput: {
    width: 40,
    height: 28,
    border: '1px solid rgba(0, 0, 0, 0.1)',
    borderRadius: '6px',
    textAlign: 'center' as const,
    fontSize: '13px',
    fontWeight: 500,
    color: '#334155',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    fontFamily: '"Inter", sans-serif',
    cursor: 'pointer',
  } as React.CSSProperties,

  // Tooltip
  tooltip: {
    position: 'absolute' as const,
    top: 'calc(100% + 8px)',
    left: '50%',
    transform: 'translateX(-50%) translateY(4px)',
    padding: '6px 10px',
    backgroundColor: '#1e293b',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 500,
    borderRadius: '6px',
    whiteSpace: 'nowrap' as const,
    pointerEvents: 'none' as const,
    opacity: 0,
    transition: 'opacity 0.2s ease, transform 0.2s ease',
    zIndex: 10001,
  } as React.CSSProperties,

  // Color underbar shown beneath the text/background colour buttons
  colorBar: {
    position: 'absolute' as const,
    bottom: '5px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '16px',
    height: '3px',
    borderRadius: '2px',
  } as React.CSSProperties,

  // Colour swatch grid
  colorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(10, 1fr)',
    gap: '4px',
    padding: '8px',
    width: '256px',
  } as React.CSSProperties,

  colorSwatch: {
    width: '20px',
    height: '20px',
    borderRadius: '4px',
    cursor: 'pointer',
    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
  } as React.CSSProperties,

  // Font search input
  searchInput: {
    width: '100%',
    padding: '7px 10px',
    border: '1px solid rgba(0,0,0,0.1)',
    borderRadius: '8px',
    fontSize: '13px',
    boxSizing: 'border-box' as const,
    outline: 'none',
    fontFamily: '"Inter", sans-serif',
  } as React.CSSProperties,
};

// CSS keyframes + hover effects injection
const injectStyles = () => {
  if (typeof document !== 'undefined' && !document.getElementById('sheets-toolbar-animations')) {
    const style = document.createElement('style');
    style.id = 'sheets-toolbar-animations';
    style.textContent = `
      @keyframes sheetsToolbarFadeIn {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .sheets-toolbar-btn .sheets-toolbar-tooltip {
        transition: opacity 0.2s ease 0.4s, transform 0.2s ease 0.4s;
      }
      .sheets-toolbar-btn:hover .sheets-toolbar-tooltip {
        opacity: 1 !important;
        transform: translateX(-50%) translateY(0) !important;
        transition: opacity 0.15s ease 0.4s, transform 0.15s ease 0.4s;
      }
      .sheets-color-swatch:hover {
        transform: scale(1.15);
        box-shadow: 0 2px 8px rgba(0,0,0,0.18);
      }
    `;
    document.head.appendChild(style);
  }
};

// ============================================================================
// Toolbar Components
// ============================================================================

interface ToolbarButtonProps {
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  tooltip?: string;
  children: React.ReactNode;
}

const ToolbarButton = memo(function ToolbarButton({
  onClick,
  active,
  disabled,
  tooltip,
  children,
}: ToolbarButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      className="sheets-toolbar-btn"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.button,
        ...(isHovered && !active && !disabled ? styles.buttonHover : {}),
        ...(active ? styles.buttonActive : {}),
        ...(disabled ? styles.buttonDisabled : {}),
      }}
    >
      {children}
      {tooltip && (
        <span className="sheets-toolbar-tooltip" style={styles.tooltip}>
          {tooltip}
        </span>
      )}
    </button>
  );
});

const Divider = memo(function Divider() {
  return <div style={styles.divider} />;
});

interface DropdownMenuProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  align?: 'left' | 'right';
  width?: number;
}

const DropdownMenu = memo(function DropdownMenu({
  isOpen,
  onClose,
  children,
  align = 'left',
  width,
}: DropdownMenuProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        ...styles.dropdown,
        ...(align === 'right' ? { left: 'auto', right: 0 } : {}),
        ...(width ? { minWidth: width } : {}),
      }}
      onMouseLeave={onClose}
    >
      {children}
    </div>
  );
});

interface DropdownItemProps {
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

const DropdownItem = memo(function DropdownItem({
  onClick,
  active,
  children,
  style: customStyle,
}: DropdownItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.dropdownItem,
        ...(isHovered ? styles.dropdownItemHover : {}),
        ...(active ? styles.dropdownItemActive : {}),
        ...customStyle,
      }}
    >
      {children}
    </div>
  );
});

// ============================================================================
// Toolbar
// ============================================================================

interface ToolbarProps {
  onBold?: () => void;
  onItalic?: () => void;
  onUnderline?: () => void;
  onStrikethrough?: () => void;
  onFontFamily?: (fontFamily: string) => void;
  onFontSize?: (fontSize: number) => void;
  onFontColor?: (color: string) => void;
  onBackgroundColor?: (color: string) => void;
  onBorder?: (border: 'top' | 'right' | 'bottom' | 'left' | 'all' | 'none') => void;
  onAlignLeft?: () => void;
  onAlignCenter?: () => void;
  onAlignRight?: () => void;
  onVerticalAlign?: (align: 'top' | 'middle' | 'bottom') => void;
  onTextWrap?: () => void;
  onTextRotation?: (angle: number) => void;
  onFormatCurrency?: () => void;
  onFormatPercentage?: () => void;
  onFormatNumber?: () => void;
  onMergeCells?: () => void;
  onHyperlink?: (url: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  // Freeze pane controls
  onFreezeRows?: (rows: number) => void;
  onFreezeCols?: (cols: number) => void;
  onUnfreeze?: () => void;
  frozenRows?: number;
  frozenCols?: number;
  // Sort & filter (operate on the active column)
  activeColumn?: number;
  onSortColumn?: (column: number, direction: 'asc' | 'desc') => void;
  onFilterColumn?: (column: number) => void;
  // Comments panel
  onToggleComments?: () => void;
  commentsActive?: boolean;
  selectedFormat?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontFamily?: string;
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
    align?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    textWrap?: boolean;
    format?: FormatType;
    hyperlink?: string;
  };
}

export const Toolbar = memo(function Toolbar({
  onBold,
  onItalic,
  onUnderline,
  onStrikethrough,
  onFontFamily,
  onFontSize,
  onFontColor,
  onBackgroundColor,
  onBorder,
  onAlignLeft,
  onAlignCenter,
  onAlignRight,
  onVerticalAlign,
  onTextWrap,
  onTextRotation,
  onFormatCurrency,
  onFormatPercentage,
  onFormatNumber,
  onMergeCells,
  onHyperlink,
  onUndo,
  onRedo,
  onFreezeRows,
  onFreezeCols,
  onUnfreeze,
  frozenRows = 0,
  frozenCols = 0,
  activeColumn,
  onSortColumn,
  onFilterColumn,
  onToggleComments,
  commentsActive,
  selectedFormat,
}: ToolbarProps) {
  const [showFontDropdown, setShowFontDropdown] = useState(false);
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState<'font' | 'background' | null>(null);
  const [showBorderMenu, setShowBorderMenu] = useState(false);
  const [showVerticalAlignMenu, setShowVerticalAlignMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [showHyperlinkModal, setShowHyperlinkModal] = useState(false);
  const [showFreezeMenu, setShowFreezeMenu] = useState(false);
  const [fontSearchQuery, setFontSearchQuery] = useState('');
  const loadedFontsRef = useRef<Set<string>>(new Set());
  const toolbarRef = useRef<HTMLDivElement>(null);

  const hasFrozenPanes = frozenRows > 0 || frozenCols > 0;
  const hasActiveColumn = activeColumn !== undefined;

  // Inject animation styles once
  useEffect(() => {
    injectStyles();
  }, []);

  // Close all dropdowns when clicking outside the toolbar
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setShowFontDropdown(false);
        setShowFontSizeDropdown(false);
        setShowColorPicker(null);
        setShowBorderMenu(false);
        setShowVerticalAlignMenu(false);
        setShowSortMenu(false);
        setShowFreezeMenu(false);
        setFontSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Comprehensive list of Google Fonts
  const googleFonts = [
    // Sans-serif fonts
    'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Source Sans Pro', 'Raleway', 'Poppins', 'Oswald', 'Ubuntu', 'Nunito',
    'Playfair Display', 'Merriweather', 'PT Sans', 'Roboto Condensed', 'Roboto Slab', 'Dosis', 'Cabin', 'Arimo',
    'Fira Sans', 'Noto Sans', 'Work Sans', 'Muli', 'Quicksand', 'Droid Sans', 'Titillium Web', 'Cantarell',
    'Josefin Sans', 'Libre Franklin', 'Rubik', 'Barlow', 'Hind', 'Varela Round', 'Karla', 'Comfortaa',
    'Crimson Text', 'Lora', 'PT Serif', 'Playfair Display SC', 'Libre Baskerville', 'Bitter', 'Cormorant Garamond',
    'EB Garamond', 'Lora', 'Merriweather Sans', 'Source Serif Pro', 'Abril Fatface', 'Anton', 'Bebas Neue',
    'Fjalla One', 'Righteous', 'Satisfy', 'Dancing Script', 'Pacifico', 'Shadows Into Light', 'Indie Flower',
    'Permanent Marker', 'Amatic SC', 'Caveat', 'Kalam', 'Gloria Hallelujah', 'Handlee', 'Patrick Hand',
    'Shadows Into Light Two', 'Architects Daughter', 'Coming Soon', 'Covered By Your Grace', 'Kaushan Script',
    'Lobster', 'Lobster Two', 'Marck Script', 'Satisfy', 'Yellowtail', 'Abril Fatface', 'Alfa Slab One',
    'Bangers', 'Bebas Neue', 'Bungee', 'Bungee Inline', 'Bungee Shade', 'Creepster', 'Fascinate', 'Fascinate Inline',
    'Faster One', 'Fredoka One', 'Frijole', 'Gravitas One', 'Iceberg', 'Impact', 'Irish Grover', 'Keania One',
    'Lilita One', 'Luckiest Guy', 'Monoton', 'Nosifer', 'Orbitron', 'Piedra', 'Plaster', 'Press Start 2P',
    'Ribeye', 'Ribeye Marrow', 'Russo One', 'Seymour One', 'Sigmar One', 'Stalinist One', 'Stardos Stencil',
    'Stint Ultra Condensed', 'Ultra', 'UnifrakturCook', 'UnifrakturMaguntia', 'Vast Shadow', 'Vampiro One',
    'Wallpoet', 'Wellfleet', 'Alegreya', 'Alegreya Sans', 'Alegreya SC', 'Alice', 'Alike', 'Alike Angular',
    'Allan', 'Allerta', 'Allerta Stencil', 'Amarante', 'Amaranth', 'Amethysta', 'Anaheim', 'Andada', 'Andika',
    'Angkor', 'Annie Use Your Telescope', 'Anonymous Pro', 'Antic', 'Antic Didone', 'Antic Slab', 'Anton',
    'Arapey', 'Arbutus', 'Arbutus Slab', 'Architects Daughter', 'Archivo', 'Archivo Black', 'Archivo Narrow',
    'Arimo', 'Arizonia', 'Armata', 'Artifika', 'Arvo', 'Asap', 'Asap Condensed', 'Asset', 'Astloch', 'Asul',
    'Atomic Age', 'Aubrey', 'Audiowide', 'Autour One', 'Average', 'Average Sans', 'Averia Gruesa Libre',
    'Averia Libre', 'Averia Sans Libre', 'Averia Serif Libre', 'Bad Script', 'Balthazar', 'Bangers', 'Basic',
    'Battambang', 'Baumans', 'Bayon', 'Belgrano', 'Belleza', 'BenchNine', 'Bentham', 'Berkshire Swash',
    'Bevan', 'Bigelow Rules', 'Bigshot One', 'Bilbo', 'Bilbo Swash Caps', 'Biryani', 'Bitter', 'Black Ops One',
    'Bokor', 'Bonbon', 'Boogaloo', 'Bowlby One', 'Bowlby One SC', 'Brawler', 'Bree Serif', 'Bubblegum Sans',
    'Bubbler One', 'Buda', 'Buenard', 'Butcherman', 'Butterfly Kids', 'Cabin', 'Cabin Condensed', 'Cabin Sketch',
    'Caesar Dressing', 'Cagliostro', 'Calligraffitti', 'Cambay', 'Cambo', 'Candal', 'Cantarell', 'Cantata One',
    'Cantora One', 'Capriola', 'Cardo', 'Carme', 'Carrois Gothic', 'Carrois Gothic SC', 'Carter One', 'Catamaran',
    'Caudex', 'Cedarville Cursive', 'Ceviche One', 'Changa', 'Changa One', 'Chango', 'Chau Philomene One',
    'Chela One', 'Chelsea Market', 'Chenla', 'Cherry Cream Soda', 'Cherry Swash', 'Chewy', 'Chicle', 'Chivo',
    'Chonburi', 'Cinzel', 'Cinzel Decorative', 'Clicker Script', 'Coda', 'Coda Caption', 'Codystar', 'Combo',
    'Comfortaa', 'Coming Soon', 'Concert One', 'Condiment', 'Content', 'Contrail One', 'Convergence', 'Cookie',
    'Copse', 'Corben', 'Courgette', 'Cousine', 'Coustard', 'Covered By Your Grace', 'Crafty Girls', 'Creepster',
    'Crete Round', 'Crimson Text', 'Croissant One', 'Crushed', 'Cuprum', 'Cutive', 'Cutive Mono', 'Damion',
    'Dancing Script', 'Dangrek', 'Dawning of a New Day', 'Days One', 'Dekko', 'Delius', 'Delius Swash Caps',
    'Delius Unicase', 'Della Respira', 'Denk One', 'Devonshire', 'Dhurjati', 'Didact Gothic', 'Diplomata',
    'Diplomata SC', 'Domine', 'Donegal One', 'Doppio One', 'Dorsa', 'Dosis', 'Dr Sugiyama', 'Droid Sans',
    'Droid Sans Mono', 'Droid Serif', 'Duru Sans', 'Dynalight', 'EB Garamond', 'Eagle Lake', 'Eater', 'Economica',
    'Eczar', 'Ek Mukta', 'Electrolize', 'Elsie', 'Elsie Swash Caps', 'Emblema One', 'Emilys Candy', 'Engagement',
    'Englebert', 'Enriqueta', 'Erica One', 'Esteban', 'Euphoria Script', 'Ewert', 'Exo', 'Exo 2', 'Expletus Sans',
    'Fanwood Text', 'Fascinate', 'Fascinate Inline', 'Faster One', 'Fasthand', 'Fauna One', 'Federant',
    'Federo', 'Felipa', 'Fenix', 'Finger Paint', 'Fira Mono', 'Fira Sans', 'Fjalla One', 'Fjord One', 'Flamenco',
    'Flavors', 'Fondamento', 'Fontdiner Swanky', 'Forum', 'Francois One', 'Freckle Face', 'Fredericka the Great',
    'Fredoka One', 'Freehand', 'Fresca', 'Frijole', 'Fruktur', 'Fugaz One', 'GFS Didot', 'GFS Neohellenic',
    'Gabriela', 'Gafata', 'Galdeano', 'Galindo', 'Gentium Basic', 'Gentium Book Basic', 'Geo', 'Geostar',
    'Geostar Fill', 'Germania One', 'Gidugu', 'Gilda Display', 'Give You Glory', 'Glass Antiqua', 'Glegoo',
    'Gloria Hallelujah', 'Goblin One', 'Gochi Hand', 'Gorditas', 'Goudy Bookletter 1911', 'Graduate', 'Grand Hotel',
    'Gravitas One', 'Great Vibes', 'Griffy', 'Gruppo', 'Gudea', 'Gurajada', 'Habibi', 'Halant', 'Hammersmith One',
    'Hanalei', 'Hanalei Fill', 'Handlee', 'Hanuman', 'Happy Monkey', 'Harmattan', 'Headland One', 'Henny Penny',
    'Herr Von Muellerhoff', 'Hind', 'Hind Guntur', 'Hind Madurai', 'Hind Siliguri', 'Hind Vadodara', 'Holtwood One SC',
    'Homemade Apple', 'Homenaje', 'IM Fell DW Pica', 'IM Fell DW Pica SC', 'IM Fell Double Pica', 'IM Fell Double Pica SC',
    'IM Fell English', 'IM Fell English SC', 'IM Fell French Canon', 'IM Fell French Canon SC', 'IM Fell Great Primer',
    'IM Fell Great Primer SC', 'Iceberg', 'Iceland', 'Imprima', 'Inconsolata', 'Inder', 'Indie Flower', 'Inika',
    'Inknut Antiqua', 'Irish Grover', 'Istok Web', 'Italiana', 'Itim', 'Jacques Francois', 'Jacques Francois Shadow',
    'Jaldi', 'Jim Nightshade', 'Jockey One', 'Jolly Lodger', 'Josefin Sans', 'Josefin Slab', 'Joti One', 'Judson',
    'Julee', 'Julius Sans One', 'Junge', 'Jura', 'Just Another Hand', 'Just Me Again Down Here', 'Kadwa', 'Kalam',
    'Kameron', 'Kanit', 'Kantumruy', 'Karla', 'Karma', 'Katibeh', 'Kaushan Script', 'Kavivanar', 'Kavoon',
    'Kdam Thmor', 'Keania One', 'Kelly Slab', 'Kenia', 'Khand', 'Khmer', 'Khula', 'Kite One', 'Knewave',
    'Kotta One', 'Koulen', 'Kranky', 'Kreon', 'Kristi', 'Krona One', 'Kumar One', 'Kumar One Outline', 'Kurale',
    'La Belle Aurore', 'Laila', 'Lakki Reddy', 'Lancelot', 'Lateef', 'Lato', 'League Script', 'Leckerli One',
    'Ledger', 'Lekton', 'Lemon', 'Lemonada', 'Libre Baskerville', 'Libre Franklin', 'Life Savers', 'Lilita One',
    'Lily Script One', 'Limelight', 'Linden Hill', 'Lobster', 'Lobster Two', 'Londrina Outline', 'Londrina Shadow',
    'Londrina Sketch', 'Londrina Solid', 'Lora', 'Love Ya Like A Sister', 'Loved by the King', 'Lovers Quarrel',
    'Luckiest Guy', 'Lusitana', 'Lustria', 'Macondo', 'Macondo Swash Caps', 'Magra', 'Maiden Orange', 'Mako',
    'Mallanna', 'Mandali', 'Marcellus', 'Marcellus SC', 'Marck Script', 'Margarine', 'Marko One', 'Marmelad',
    'Martel', 'Martel Sans', 'Marvel', 'Mate', 'Mate SC', 'Maven Pro', 'McLaren', 'Meddon', 'MedievalSharp',
    'Medula One', 'Megrim', 'Meie Script', 'Merienda', 'Merienda One', 'Merriweather', 'Merriweather Sans',
    'Metal', 'Metal Mania', 'Metamorphous', 'Metrophobic', 'Michroma', 'Milonga', 'Miltonian', 'Miltonian Tattoo',
    'Miniver', 'Mirza', 'Miss Fajardose', 'Modak', 'Modern Antiqua', 'Mogra', 'Molengo', 'Molle', 'Monda',
    'Monofett', 'Monoton', 'Monsieur La Doulaise', 'Montaga', 'Montez', 'Montserrat', 'Montserrat Alternates',
    'Montserrat Subrayada', 'Moul', 'Moulpali', 'Mountains of Christmas', 'Mouse Memoirs', 'Mr Bedfort',
    'Mr Dafoe', 'Mr De Haviland', 'Mrs Saint Delafield', 'Mrs Sheppards', 'Muli', 'Mystery Quest', 'NTR',
    'Neucha', 'Neuton', 'New Rocker', 'News Cycle', 'Niconne', 'Nixie One', 'Nobile', 'Nokora', 'Norican', 'Nosifer',
    'Nothing You Could Do', 'Noticia Text', 'Noto Sans', 'Noto Serif', 'Nova Cut', 'Nova Flat', 'Nova Mono',
    'Nova Oval', 'Nova Round', 'Nova Script', 'Nova Slim', 'Nova Square', 'Numans', 'Nunito', 'Odor Mean Chey',
    'Offside', 'Old Standard TT', 'Oldenburg', 'Oleo Script', 'Oleo Script Swash Caps', 'Open Sans', 'Open Sans Condensed',
    'Oranienbaum', 'Orbitron', 'Oregano', 'Orienta', 'Original Surfer', 'Oswald', 'Over the Rainbow', 'Overlock',
    'Overlock SC', 'Ovo', 'Oxygen', 'Oxygen Mono', 'PT Mono', 'PT Sans', 'PT Sans Caption', 'PT Sans Narrow',
    'PT Serif', 'PT Serif Caption', 'Pacifico', 'Palanquin', 'Palanquin Dark', 'Pangolin', 'Paprika', 'Parisienne',
    'Passero One', 'Passion One', 'Pathway Gothic One', 'Patrick Hand', 'Patrick Hand SC', 'Pattaya', 'Patua One',
    'Paytone One', 'Peddana', 'Peralta', 'Permanent Marker', 'Petit Formal Script', 'Petrona', 'Philosopher',
    'Piedra', 'Pinyon Script', 'Pirata One', 'Plaster', 'Play', 'Playball', 'Playfair Display', 'Playfair Display SC',
    'Podkova', 'Poiret One', 'Poller One', 'Poly', 'Pompiere', 'Pontano Sans', 'Poppins', 'Port Lligat Sans',
    'Port Lligat Slab', 'Pragati Narrow', 'Prata', 'Preahvihear', 'Press Start 2P', 'Princess Sofia', 'Prociono',
    'Prosto One', 'Puritan', 'Purple Purse', 'Quando', 'Quantico', 'Quattrocento', 'Quattrocento Sans', 'Questrial',
    'Quicksand', 'Quintessential', 'Qwigley', 'Racing Sans One', 'Radley', 'Rajdhani', 'Raleway', 'Raleway Dots',
    'Ramabhadra', 'Ramaraja', 'Rambla', 'Rammetto One', 'Ranchers', 'Rancho', 'Ranga', 'Rasa', 'Rationale',
    'Ravi Prakash', 'Redressed', 'Reem Kufi', 'Reenie Beanie', 'Revalia', 'Rhodium Libre', 'Ribeye', 'Ribeye Marrow',
    'Righteous', 'Risque', 'Roboto', 'Roboto Condensed', 'Roboto Mono', 'Roboto Slab', 'Rochester', 'Rock Salt',
    'Rokkitt', 'Romanesco', 'Ropa Sans', 'Rosario', 'Rosarivo', 'Rouge Script', 'Rozha One', 'Rubik', 'Rubik Mono One',
    'Ruda', 'Rufina', 'Ruge Boogie', 'Ruluko', 'Rum Raisin', 'Ruslan Display', 'Russo One', 'Ruthie', 'Rye',
    'Sacramento', 'Sahitya', 'Sail', 'Salsa', 'Sanchez', 'Sancreek', 'Sansita One', 'Sarabun', 'Sarala', 'Sarina',
    'Sarpanch', 'Satisfy', 'Scada', 'Scheherazade', 'Schoolbell', 'Seaweed Script', 'Sevillana', 'Seymour One',
    'Shadows Into Light', 'Shadows Into Light Two', 'Shanti', 'Share', 'Share Tech', 'Share Tech Mono', 'Shojumaru',
    'Short Stack', 'Shrikhand', 'Siemreap', 'Sigmar One', 'Signika', 'Signika Negative', 'Simonetta', 'Sintony',
    'Sirin Stencil', 'Six Caps', 'Skranji', 'Slabo 13px', 'Slabo 27px', 'Slackey', 'Smokum', 'Smythe', 'Sniglet',
    'Snippet', 'Snowburst One', 'Sofadi One', 'Sofia', 'Sonsie One', 'Sorts Mill Goudy', 'Source Code Pro',
    'Source Sans Pro', 'Source Serif Pro', 'Space Mono', 'Special Elite', 'Spicy Rice', 'Spinnaker', 'Spirax',
    'Squada One', 'Sree Krushnadevaraya', 'Sriracha', 'Stalemate', 'Stalinist One', 'Stardos Stencil', 'Stint Ultra Condensed',
    'Stint Ultra Expanded', 'Stoke', 'Strait', 'Sue Ellen Francisco', 'Suez One', 'Sumana', 'Sunshiney', 'Supermercado One',
    'Sura', 'Suranna', 'Suravaram', 'Suwannaphum', 'Swanky and Moo Moo', 'Syncopate', 'Tangerine', 'Taprom', 'Tauri',
    'Taviraj', 'Teko', 'Telex', 'Tenor Sans', 'Text Me One', 'The Girl Next Door', 'Tienne', 'Tillana', 'Timmana',
    'Tinos', 'Titan One', 'Titillium Web', 'Trade Winds', 'Trirong', 'Trocchi', 'Trochut', 'Trykker', 'Tulpen One',
    'Ubuntu', 'Ubuntu Condensed', 'Ubuntu Mono', 'Ultra', 'Uncial Antiqua', 'Underdog', 'Unica One', 'UnifrakturCook',
    'UnifrakturMaguntia', 'Unkempt', 'Unlock', 'Unna', 'VT323', 'Vampiro One', 'Varela', 'Varela Round', 'Vast Shadow',
    'Vesper Libre', 'Vibur', 'Vidaloka', 'Viga', 'Voces', 'Volkhov', 'Vollkorn', 'Voltaire', 'Waiting for the Sunrise',
    'Wallpoet', 'Walter Turncoat', 'Warnes', 'Wellfleet', 'Wendy One', 'Wire One', 'Work Sans', 'Yanone Kaffeesatz',
    'Yantramanav', 'Yatra One', 'Yellowtail', 'Yeseva One', 'Yesteryear', 'Yrsa', 'Zeyada', 'Zilla Slab'
  ];

  // Filter fonts based on search query
  const filteredFonts = useMemo(
    () =>
      googleFonts.filter((font) =>
        font.toLowerCase().includes(fontSearchQuery.toLowerCase())
      ),
    [fontSearchQuery]
  );

  // Dynamically load Google Fonts on demand
  useEffect(() => {
    if (!showFontDropdown) return;

    const loadGoogleFontsBatch = (fontFamilies: string[]) => {
      const fontsToLoad = fontFamilies.filter((font) => {
        if (loadedFontsRef.current.has(font)) return false;
        const existingLink = document.querySelector(`link[data-font="${font}"]`);
        if (existingLink) {
          loadedFontsRef.current.add(font);
          return false;
        }
        return true;
      });

      if (fontsToLoad.length === 0) return;

      const batchSize = 10;
      for (let i = 0; i < fontsToLoad.length; i += batchSize) {
        const batch = fontsToLoad.slice(i, i + batchSize);
        const fontNames = batch.map((font) => font.replace(/\s+/g, '+')).join('&family=');

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${fontNames}:wght@400&display=swap`;
        link.setAttribute('data-fonts', batch.join(','));
        document.head.appendChild(link);

        batch.forEach((font) => loadedFontsRef.current.add(font));
      }
    };

    const fontsToLoad = filteredFonts.slice(0, 50);
    loadGoogleFontsBatch(fontsToLoad);
  }, [showFontDropdown, filteredFonts]);

  const commonFontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72];
  const commonColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
    '#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
    '#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
    '#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
    '#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
    '#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
    '#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130',
  ];

  const currentFontSize = selectedFormat?.fontSize || 11;
  const currentFontFamily = selectedFormat?.fontFamily || 'Arial';

  const stepFontSize = (direction: 'down' | 'up') => {
    const idx = commonFontSizes.indexOf(currentFontSize);
    if (direction === 'down') {
      if (idx > 0) {
        onFontSize?.(commonFontSizes[idx - 1]);
      } else if (idx === -1) {
        const smaller = [...commonFontSizes].reverse().find((s) => s < currentFontSize);
        if (smaller) onFontSize?.(smaller);
      }
    } else {
      if (idx !== -1 && idx < commonFontSizes.length - 1) {
        onFontSize?.(commonFontSizes[idx + 1]);
      } else if (idx === -1) {
        const next = commonFontSizes.find((s) => s > currentFontSize);
        if (next) onFontSize?.(next);
      }
    }
  };

  const renderColorPicker = (mode: 'font' | 'background') => {
    const apply = mode === 'font' ? onFontColor : onBackgroundColor;
    return (
      <div
        style={{ ...styles.dropdown, padding: '4px' }}
        onMouseLeave={() => setShowColorPicker(null)}
      >
        <div style={styles.colorGrid}>
          {commonColors.map((color) => (
            <div
              key={color}
              className="sheets-color-swatch"
              onClick={() => {
                apply?.(color);
                setShowColorPicker(null);
              }}
              style={{ ...styles.colorSwatch, backgroundColor: color }}
              title={color}
            />
          ))}
        </div>
        <div style={{ padding: '0 8px 8px' }}>
          <input
            type="color"
            onChange={(e) => {
              apply?.(e.target.value);
              setShowColorPicker(null);
            }}
            style={{
              width: '100%',
              height: '32px',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '8px',
              cursor: 'pointer',
              background: 'transparent',
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div ref={toolbarRef} className="sheets-toolbar" style={styles.toolbar}>
      {/* Undo / Redo */}
      <ToolbarButton onClick={onUndo} tooltip="Undo (Ctrl+Z)">
        <Undo2 size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton onClick={onRedo} tooltip="Redo (Ctrl+Y)">
        <Redo2 size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Font Family */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setShowFontDropdown(!showFontDropdown)}
          style={{
            ...styles.dropdownButton,
            minWidth: 116,
            ...(showFontDropdown ? styles.buttonActive : {}),
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 84,
              fontFamily: `"${currentFontFamily}", sans-serif`,
            }}
          >
            {currentFontFamily}
          </span>
          <ChevronDown size={14} />
        </button>
        {showFontDropdown && (
          <div
            style={{
              ...styles.dropdown,
              padding: 0,
              minWidth: 240,
            }}
            onMouseLeave={() => {
              setShowFontDropdown(false);
              setFontSearchQuery('');
            }}
          >
            <div style={{ padding: '8px', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <input
                type="text"
                placeholder="Search fonts..."
                value={fontSearchQuery}
                onChange={(e) => setFontSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                style={styles.searchInput}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px' }}>
              {filteredFonts.length === 0 ? (
                <div
                  style={{
                    padding: '12px',
                    color: '#94a3b8',
                    fontSize: '13px',
                    textAlign: 'center',
                  }}
                >
                  No fonts found
                </div>
              ) : (
                filteredFonts.map((font, index) => (
                  <DropdownItem
                    key={`${font}-${index}`}
                    onClick={() => {
                      onFontFamily?.(font);
                      setShowFontDropdown(false);
                      setFontSearchQuery('');
                    }}
                    active={selectedFormat?.fontFamily === font}
                    style={{ fontFamily: `"${font}", sans-serif` }}
                  >
                    {font}
                  </DropdownItem>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Font Size */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ToolbarButton onClick={() => stepFontSize('down')} tooltip="Decrease font size">
          <Minus size={14} strokeWidth={2.5} />
        </ToolbarButton>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            value={currentFontSize}
            readOnly
            onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
            style={styles.fontSizeInput}
          />
          {showFontSizeDropdown && (
            <div
              style={{
                ...styles.dropdown,
                left: '50%',
                transform: 'translateX(-50%)',
                minWidth: 64,
                maxHeight: 240,
                overflowY: 'auto',
              }}
              onMouseLeave={() => setShowFontSizeDropdown(false)}
            >
              {commonFontSizes.map((size) => (
                <DropdownItem
                  key={size}
                  onClick={() => {
                    onFontSize?.(size);
                    setShowFontSizeDropdown(false);
                  }}
                  active={currentFontSize === size}
                  style={{ justifyContent: 'center' }}
                >
                  {size}
                </DropdownItem>
              ))}
            </div>
          )}
        </div>
        <ToolbarButton onClick={() => stepFontSize('up')} tooltip="Increase font size">
          <Plus size={14} strokeWidth={2.5} />
        </ToolbarButton>
      </div>

      <Divider />

      {/* Text Formatting */}
      <ToolbarButton onClick={onBold} active={selectedFormat?.bold} tooltip="Bold (Ctrl+B)">
        <Bold size={18} strokeWidth={2.5} />
      </ToolbarButton>
      <ToolbarButton onClick={onItalic} active={selectedFormat?.italic} tooltip="Italic (Ctrl+I)">
        <Italic size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onUnderline}
        active={selectedFormat?.underline}
        tooltip="Underline (Ctrl+U)"
      >
        <Underline size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onStrikethrough}
        active={selectedFormat?.strikethrough}
        tooltip="Strikethrough"
      >
        <Strikethrough size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Font Color */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowColorPicker(showColorPicker === 'font' ? null : 'font')}
          active={showColorPicker === 'font'}
          tooltip="Text color"
        >
          <Palette size={18} strokeWidth={2} />
          <span
            style={{ ...styles.colorBar, backgroundColor: selectedFormat?.fontColor || '#1e293b' }}
          />
        </ToolbarButton>
        {showColorPicker === 'font' && renderColorPicker('font')}
      </div>

      {/* Background Color */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowColorPicker(showColorPicker === 'background' ? null : 'background')}
          active={showColorPicker === 'background'}
          tooltip="Fill color"
        >
          <PaintBucket size={18} strokeWidth={2} />
          <span
            style={{
              ...styles.colorBar,
              backgroundColor: selectedFormat?.backgroundColor || '#cbd5e1',
            }}
          />
        </ToolbarButton>
        {showColorPicker === 'background' && renderColorPicker('background')}
      </div>

      {/* Borders */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowBorderMenu(!showBorderMenu)}
          active={showBorderMenu}
          tooltip="Borders"
        >
          <Grid2x2 size={18} strokeWidth={2} />
        </ToolbarButton>
        <DropdownMenu
          isOpen={showBorderMenu}
          onClose={() => setShowBorderMenu(false)}
          width={150}
        >
          {(['all', 'top', 'right', 'bottom', 'left', 'none'] as const).map((border) => (
            <DropdownItem
              key={border}
              onClick={() => {
                onBorder?.(border);
                setShowBorderMenu(false);
              }}
            >
              {border === 'all'
                ? 'All borders'
                : border === 'none'
                  ? 'No border'
                  : `${border.charAt(0).toUpperCase()}${border.slice(1)} border`}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </div>

      <Divider />

      {/* Horizontal Alignment */}
      <ToolbarButton
        onClick={onAlignLeft}
        active={selectedFormat?.align === 'left'}
        tooltip="Align left"
      >
        <AlignLeft size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onAlignCenter}
        active={selectedFormat?.align === 'center'}
        tooltip="Align center"
      >
        <AlignCenter size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onAlignRight}
        active={selectedFormat?.align === 'right'}
        tooltip="Align right"
      >
        <AlignRight size={18} strokeWidth={2} />
      </ToolbarButton>

      {/* Vertical Alignment */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowVerticalAlignMenu(!showVerticalAlignMenu)}
          active={showVerticalAlignMenu}
          tooltip="Vertical align"
        >
          <AlignVerticalJustifyCenter size={18} strokeWidth={2} />
        </ToolbarButton>
        <DropdownMenu
          isOpen={showVerticalAlignMenu}
          onClose={() => setShowVerticalAlignMenu(false)}
          width={130}
        >
          {(['top', 'middle', 'bottom'] as const).map((align) => (
            <DropdownItem
              key={align}
              onClick={() => {
                onVerticalAlign?.(align);
                setShowVerticalAlignMenu(false);
              }}
              active={selectedFormat?.verticalAlign === align}
            >
              {align.charAt(0).toUpperCase() + align.slice(1)}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </div>

      {/* Text Wrap */}
      <ToolbarButton onClick={onTextWrap} active={selectedFormat?.textWrap} tooltip="Wrap text">
        <WrapText size={18} strokeWidth={2} />
      </ToolbarButton>

      {/* Text Rotation */}
      <ToolbarButton onClick={() => onTextRotation?.(45)} tooltip="Rotate text">
        <RotateCw size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Number Formatting */}
      <ToolbarButton
        onClick={onFormatCurrency}
        active={selectedFormat?.format === 'currency'}
        tooltip="Currency format"
      >
        <DollarSign size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onFormatPercentage}
        active={selectedFormat?.format === 'percentage'}
        tooltip="Percentage format"
      >
        <Percent size={18} strokeWidth={2} />
      </ToolbarButton>
      <ToolbarButton
        onClick={onFormatNumber}
        active={selectedFormat?.format === 'number'}
        tooltip="Number format"
      >
        <Hash size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Merge Cells */}
      <ToolbarButton onClick={onMergeCells} tooltip="Merge cells">
        <Combine size={18} strokeWidth={2} />
      </ToolbarButton>

      {/* Hyperlink */}
      <ToolbarButton
        onClick={() => setShowHyperlinkModal(true)}
        active={!!selectedFormat?.hyperlink}
        tooltip="Insert link"
      >
        <Link size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Sort */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowSortMenu(!showSortMenu)}
          active={showSortMenu}
          disabled={!hasActiveColumn}
          tooltip={hasActiveColumn ? 'Sort column' : 'Select a cell to sort'}
        >
          <ArrowDownAZ size={18} strokeWidth={2} />
        </ToolbarButton>
        <DropdownMenu isOpen={showSortMenu} onClose={() => setShowSortMenu(false)} width={150}>
          <DropdownItem
            onClick={() => {
              if (hasActiveColumn) onSortColumn?.(activeColumn as number, 'asc');
              setShowSortMenu(false);
            }}
          >
            <ArrowDownAZ size={16} strokeWidth={2} />
            Sort sheet A → Z
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              if (hasActiveColumn) onSortColumn?.(activeColumn as number, 'desc');
              setShowSortMenu(false);
            }}
          >
            <ArrowUpAZ size={16} strokeWidth={2} />
            Sort sheet Z → A
          </DropdownItem>
        </DropdownMenu>
      </div>

      {/* Filter */}
      <ToolbarButton
        onClick={() => {
          if (hasActiveColumn) onFilterColumn?.(activeColumn as number);
        }}
        disabled={!hasActiveColumn}
        tooltip={hasActiveColumn ? 'Filter column' : 'Select a cell to filter'}
      >
        <Filter size={18} strokeWidth={2} />
      </ToolbarButton>

      <Divider />

      {/* Freeze Panes */}
      <div style={{ position: 'relative' }}>
        <ToolbarButton
          onClick={() => setShowFreezeMenu(!showFreezeMenu)}
          active={showFreezeMenu || hasFrozenPanes}
          tooltip="Freeze panes"
        >
          <Snowflake size={18} strokeWidth={2} />
        </ToolbarButton>
        <DropdownMenu
          isOpen={showFreezeMenu}
          onClose={() => setShowFreezeMenu(false)}
          align="right"
          width={210}
        >
          <div style={styles.menuLabel}>Freeze panes</div>
          <DropdownItem
            onClick={() => {
              onFreezeRows?.(1);
              setShowFreezeMenu(false);
            }}
            active={frozenRows === 1 && frozenCols === 0}
          >
            Freeze top row
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              onFreezeCols?.(1);
              setShowFreezeMenu(false);
            }}
            active={frozenCols === 1 && frozenRows === 0}
          >
            Freeze first column
          </DropdownItem>
          <DropdownItem
            onClick={() => {
              onFreezeRows?.(1);
              onFreezeCols?.(1);
              setShowFreezeMenu(false);
            }}
            active={frozenRows === 1 && frozenCols === 1}
          >
            Freeze first row & column
          </DropdownItem>
          {hasFrozenPanes && (
            <>
              <div style={{ ...styles.divider, width: 'auto', height: 1, margin: '4px 6px' }} />
              <DropdownItem
                onClick={() => {
                  onUnfreeze?.();
                  setShowFreezeMenu(false);
                }}
                style={{ color: '#ef4444' }}
              >
                Unfreeze panes
              </DropdownItem>
              <div
                style={{
                  padding: '4px 12px 6px',
                  color: '#94a3b8',
                  fontSize: '11px',
                }}
              >
                Current: {frozenRows > 0 ? `${frozenRows} row${frozenRows > 1 ? 's' : ''}` : ''}
                {frozenRows > 0 && frozenCols > 0 ? ', ' : ''}
                {frozenCols > 0 ? `${frozenCols} col${frozenCols > 1 ? 's' : ''}` : ''}
              </div>
            </>
          )}
        </DropdownMenu>
      </div>

      <Divider />

      {/* Comments */}
      <ToolbarButton onClick={onToggleComments} active={commentsActive} tooltip="Comments">
        <MessageSquare size={18} strokeWidth={2} />
      </ToolbarButton>

      {/* Hyperlink Modal */}
      <HyperlinkModal
        isOpen={showHyperlinkModal}
        initialUrl={selectedFormat?.hyperlink || ''}
        onClose={() => setShowHyperlinkModal(false)}
        onConfirm={(url) => {
          onHyperlink?.(url);
          setShowHyperlinkModal(false);
        }}
      />
    </div>
  );
});
