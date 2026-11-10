/**
 * CDN Media Optimization Utility for SocialHub
 * 
 * Leverages Cloudinary's Global CDN Edge Network to:
 * 1. Automatically convert images to modern, bandwidth-efficient WebP / AVIF formats (f_auto)
 * 2. Dynamically compress media without perceptible loss of quality (q_auto)
 * 3. Resize and crop images/avatars to target device screen dimensions (w_..., c_limit/c_fill)
 * 4. Transcode videos on the fly for smooth mobile playback (q_auto, vc_auto)
 */

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: 'auto' | 'good' | 'eco' | 'low';
  crop?: 'limit' | 'fill' | 'fit' | 'thumb';
  avatar?: boolean;
}

export interface VideoOptimizationOptions {
  width?: number;
  quality?: 'auto' | 'good' | 'eco';
}

// Neutral soft blurhash used while images are loading across the app
export const DEFAULT_BLURHASH =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj[';

/**
 * Optimizes an image URL via Cloudinary CDN edge transformations.
 * If the URL is not from Cloudinary, it is returned safely unchanged.
 */
export function getOptimizedImageUrl(
  url?: string | null,
  options: ImageOptimizationOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';

  // Only transform Cloudinary URLs
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) {
    return url;
  }

  // Avoid double-transforming if already transformed
  if (url.includes('/image/upload/f_auto') || url.includes('/image/upload/w_')) {
    return url;
  }

  const {
    width,
    height,
    quality = 'auto',
    crop = options.avatar ? 'fill' : 'limit',
    avatar = false,
  } = options;

  const transforms: string[] = ['f_auto'];

  // Quality setting
  if (quality === 'good') transforms.push('q_auto:good');
  else if (quality === 'eco') transforms.push('q_auto:eco');
  else if (quality === 'low') transforms.push('q_auto:low');
  else transforms.push('q_auto');

  // Dimensions & Cropping
  if (avatar) {
    const size = width || height || 160;
    transforms.push(`w_${size}`);
    transforms.push(`h_${size}`);
    transforms.push('c_fill');
    transforms.push('g_face'); // Face detection smart crop
  } else {
    if (width) transforms.push(`w_${width}`);
    if (height) transforms.push(`h_${height}`);
    if (crop) transforms.push(`c_${crop}`);
  }

  const transformString = transforms.join(',');
  return url.replace('/image/upload/', `/image/upload/${transformString}/`);
}

/**
 * Optimizes a video / reel URL via Cloudinary CDN edge transformations.
 */
export function getOptimizedVideoUrl(
  url?: string | null,
  options: VideoOptimizationOptions = {}
): string {
  if (!url || typeof url !== 'string') return '';

  if (!url.includes('res.cloudinary.com') || !url.includes('/video/upload/')) {
    return url;
  }

  if (url.includes('/video/upload/q_auto') || url.includes('/video/upload/w_')) {
    return url;
  }

  const { width = 720, quality = 'auto' } = options;

  const transforms: string[] = ['vc_auto'];

  if (quality === 'good') transforms.push('q_auto:good');
  else if (quality === 'eco') transforms.push('q_auto:eco');
  else transforms.push('q_auto');

  if (width) {
    transforms.push(`w_${width}`);
    transforms.push('c_limit');
  }

  const transformString = transforms.join(',');
  return url.replace('/video/upload/', `/video/upload/${transformString}/`);
}
