// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type MaterialIconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'play.rectangle.fill': 'play-circle-filled',
  'gamecontroller.fill': 'sports-esports',
  'message.fill': 'message',
  'bell.fill': 'notifications',
  'line.3.horizontal': 'menu',
  'magnifyingglass': 'search',
  'plus.circle.fill': 'add-circle',
  'person.fill': 'person',
  'person': 'person',
  'phone': 'phone',
  'phone.fill': 'phone',
  'envelope': 'mail',
  'envelope.fill': 'mail',
  'apple': 'apple',
  'google': 'login',
  'touchid': 'fingerprint',
  'mic.fill': 'mic',
  'arrow.clockwise': 'refresh',
  'arrow.counterclockwise': 'undo',
  'arrow.up': 'expand-less',
  'arrow.down': 'expand-more',
  'arrow.left': 'chevron-left',
  'arrow.right': 'chevron-right',
  'arrow.up.to.line': 'vertical-align-top',
  'arrow.down.to.line': 'vertical-align-bottom',
  'checkmark': 'check',
  'checkmark.circle.fill': 'check-circle',
  'calendar': 'calendar-today',
  'lock': 'lock',
  'at': 'alternate-email',
  'shield': 'shield',
  'camera': 'camera-alt',
  'globe': 'public',
  'xmark': 'close',
  'photo': 'photo-library',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'bubble.left': 'chat-bubble-outline',
  'bubble.left.fill': 'chat-bubble',
  'square.and.arrow.up': 'share',
  'ellipsis': 'more-horiz',
  'clock': 'schedule',
  'bookmark': 'bookmark-border',
  'bookmark.fill': 'bookmark',
  'hand.thumbsup': 'thumb-up-off-alt',
  'hand.thumbsup.fill': 'thumb-up',
  'xmark.circle.fill': 'cancel',
  'bubble.right.fill': 'chat-bubble',
  'speaker.slash.fill': 'volume-off',
  'speaker.wave.2.fill': 'volume-up',
  'person.badge.plus.fill': 'person-add',
  'sparkles': 'auto-awesome',
  'moon.fill': 'dark-mode',
  'doc.text.fill': 'description',
  'info.circle.fill': 'info',
  'arrow.right.square.fill': 'logout',
  'lock.fill': 'lock',
  'checkmark.shield.fill': 'verified-user',
  'xmark.shield.fill': 'gpp-bad',
  'lock.shield': 'security',
  'chevron.down': 'keyboard-arrow-down',
  'circle': 'radio-button-unchecked',
};

type IconSymbolName = keyof typeof MAPPING;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name] as MaterialIconName} style={style} />;
}
