// components/kanorio-image.tsx
"use client";

import Image, { type ImageProps } from "next/image";
import { isResizableImageUrl, type ResolvedImage } from "@kanorio/sdk";
import { kanorioImageLoader } from "@kanorio/sdk/next";

// The next/image options this component sets itself or has no use for. What is left of the props are plain <img> attributes,
// plus `fill`, `preload` and `loading`
type Managed = "src" | "alt" | "loader" | "quality" | "priority" | "placeholder" | "blurDataURL" | "unoptimized" | "overrideSrc";
type Legacy = "onLoadingComplete" | "layout" | "objectFit" | "objectPosition" | "lazyBoundary" | "lazyRoot";

type KanorioImageProps = Omit<ImageProps, Managed | Legacy> & {
  /** From `image.resolve`: URL, size, alt text, focal point, blurred preview and edge color */
  image: ResolvedImage;
  alt?: string;
  /** How CSS fits the image into its box: `cover` crops it, `contain` letterboxes it */
  fit?: "cover" | "contain";
};

export function KanorioImage({ image, alt, fit, style, fill, preload, loading, ...img }: KanorioImageProps) {
  const { focus, edgeColor } = image;
  const text = alt ?? image.alt ?? "";
  const imageStyle = {
    objectFit: fit,
    objectPosition: fit === "cover" && focus ? `${focus.x * 100}% ${focus.y * 100}%` : undefined,
    backgroundColor: fit === "contain" ? (edgeColor ?? undefined) : undefined,
    ...style,
  };
  const width = img.width ?? image.width ?? undefined;
  const height = img.height ?? image.height ?? undefined;
  // next/image needs a size or `fill`. An image with neither (an SVG or an external URL has no known size) is a plain <img>,
  // with the width or height you gave and every other attribute passed on
  if (!fill && !(width && height)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...img} src={image.url} alt={text} style={imageStyle} loading={loading ?? (preload ? "eager" : "lazy")} />;
  }
  // An external URL or an SVG cannot be resized by Kanorio: show it as it is
  const resizable = isResizableImageUrl(image.url);
  return (
    <Image
      {...img}
      {...(fill ? { fill } : { width, height })}
      preload={preload}
      loading={loading}
      src={image.url}
      alt={text}
      loader={resizable ? kanorioImageLoader : undefined}
      unoptimized={!resizable}
      placeholder={image.placeholder ? "blur" : "empty"}
      blurDataURL={image.placeholder ?? undefined}
      style={imageStyle}
    />
  );
}
