// @weavertime/spindle-slides-react
// React components + hooks for Spindle Slides.

// Context
export { DeckProvider, useDeckContext } from './context/DeckContext';
export type { DeckProviderProps, DeckContextValue } from './context/DeckContext';
export { ElementStore } from './context/element-store';

// Hooks
export {
  useDeck,
  useSlideIds,
  useSlide,
  useSlideElementIds,
  useElement,
  useSelection,
  useActiveSlideId,
  useTheme,
} from './hooks';

// Components
export { SlidesEditor } from './components/SlidesEditor';
export { SlideStage } from './components/SlideStage';
export { Filmstrip } from './components/Filmstrip';
export { SlideView, ScaledSlide } from './components/SlideView';
export { ElementView } from './components/elements/ElementView';
export { StaticRichText } from './components/elements/StaticRichText';
export { shapeGeom } from './components/elements/shapes';
export type { ShapeGeom } from './components/elements/shapes';
