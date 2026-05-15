'use client';

import { createAvatar } from '@dicebear/core';
import * as collection from '@dicebear/collection';

export const AVATAR_STYLES = [
  { key: 'adventurer', label: 'Aventurier' },
  { key: 'adventurerNeutral', label: 'Aventurier Neutre' },
  { key: 'avataaars', label: 'Avataaars' },
  { key: 'avataaarsNeutral', label: 'Avataaars Neutre' },
  { key: 'bigEars', label: 'Big Ears' },
  { key: 'bigEarsNeutral', label: 'Big Ears Neutre' },
  { key: 'bigSmile', label: 'Big Smile' },
  { key: 'bottts', label: 'Bottts' },
  { key: 'botttsNeutral', label: 'Bottts Neutre' },
  { key: 'croodles', label: 'Croodles' },
  { key: 'croodlesNeutral', label: 'Croodles Neutre' },
  { key: 'funEmoji', label: 'Fun Emoji' },
  { key: 'icons', label: 'Icônes' },
  { key: 'identicon', label: 'Identicon' },
  { key: 'lorelei', label: 'Lorelei' },
  { key: 'loreleiNeutral', label: 'Lorelei Neutre' },
  { key: 'micah', label: 'Micah' },
  { key: 'miniavs', label: 'Miniavs' },
  { key: 'notionists', label: 'Notionists' },
  { key: 'notionistsNeutral', label: 'Notionists Neutre' },
  { key: 'openPeeps', label: 'Open Peeps' },
  { key: 'personas', label: 'Personas' },
  { key: 'pixelArt', label: 'Pixel Art' },
  { key: 'pixelArtNeutral', label: 'Pixel Art Neutre' },
  { key: 'rings', label: 'Rings' },
  { key: 'shapes', label: 'Shapes' },
  { key: 'thumbs', label: 'Thumbs' },
] as const;

export type AvatarStyleKey = (typeof AVATAR_STYLES)[number]['key'];

const styleMap: Record<string, any> = {};
for (const [key, value] of Object.entries(collection)) {
  styleMap[key] = value;
}

export function generateAvatarSvg(
  style: string,
  seed: string,
  options: Record<string, any> = {},
): string {
  const styleObj = styleMap[style];
  if (!styleObj) return '';

  const avatar = createAvatar(styleObj, {
    seed,
    ...options,
  });

  return avatar.toString();
}
