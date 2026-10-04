import type { CSSProperties } from 'react';

const STAGE_RATIO = 4 / 3;

export type ImageDimensions = Readonly<{ width: number; height: number }>;

export const MIN_PROFILE_IMAGE_DIMENSION = 320;

export function isProfileImageLargeEnough({ width, height }: ImageDimensions): boolean {
  return width >= MIN_PROFILE_IMAGE_DIMENSION && height >= MIN_PROFILE_IMAGE_DIMENSION;
}
export type CropFrame = Readonly<{
  style: CSSProperties;
  maxLeftPercent: number;
  maxTopPercent: number;
}>;

export function getCropFrame(
  dimensions: ImageDimensions,
  x: number,
  y: number,
  zoom: number,
): CropFrame {
  const imageRatio = dimensions.width / dimensions.height;
  const contentWidth = imageRatio >= STAGE_RATIO ? 100 : (imageRatio / STAGE_RATIO) * 100;
  const contentHeight = imageRatio >= STAGE_RATIO ? (STAGE_RATIO / imageRatio) * 100 : 100;
  const contentLeft = (100 - contentWidth) / 2;
  const contentTop = (100 - contentHeight) / 2;
  const sourceSize = Math.min(dimensions.width, dimensions.height) / zoom;
  const frameWidth = contentWidth * (sourceSize / dimensions.width);
  const frameHeight = contentHeight * (sourceSize / dimensions.height);
  const maxLeftPercent = contentWidth - frameWidth;
  const maxTopPercent = contentHeight - frameHeight;

  return {
    style: {
      left: `${contentLeft + maxLeftPercent * (x / 100)}%`,
      top: `${contentTop + maxTopPercent * (y / 100)}%`,
      width: `${frameWidth}%`,
      height: `${frameHeight}%`,
    },
    maxLeftPercent,
    maxTopPercent,
  };
}
