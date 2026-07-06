"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageIcon } from "lucide-react";

interface Img {
  id: string;
  url: string;
  altText: string | null;
}

interface Props {
  images: Img[];
  title: string;
}

// Interactive gallery for the card detail page. The clicked thumbnail becomes
// the hero image; whichever image was hero moves into the thumbnail strip.
// Order rearrangement is only visual — the card's underlying image order
// (which drives Shopify) is untouched.
export default function ImageGallery({ images, title }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative flex flex-col items-center justify-center text-gray-400 gap-2">
        <ImageIcon className="w-10 h-10" />
        <span className="text-xs">No image</span>
      </div>
    );
  }

  const active = images[activeIdx];

  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 relative">
        <Image
          key={active.id}
          src={active.url}
          alt={active.altText ?? title}
          fill
          sizes="(max-width: 1024px) 100vw, 33vw"
          className="object-contain animate-in fade-in duration-200"
          unoptimized
        />
      </div>

      {images.length > 1 && (
        <div className="grid grid-cols-5 gap-2">
          {images.map((img, i) => {
            const isActive = i === activeIdx;
            return (
              <button
                key={img.id}
                type="button"
                onClick={() => setActiveIdx(i)}
                aria-label={
                  isActive
                    ? "Currently showing this image"
                    : "Show this image full-size"
                }
                aria-pressed={isActive}
                className={`
                  aspect-square rounded-lg overflow-hidden bg-gray-100 relative
                  transition-all group
                  ${
                    isActive
                      ? "ring-2 ring-blue-500 ring-offset-2 opacity-100"
                      : "ring-1 ring-gray-200 hover:ring-2 hover:ring-blue-300 opacity-70 hover:opacity-100"
                  }
                `}
              >
                <Image
                  src={img.url}
                  alt={img.altText ?? ""}
                  fill
                  sizes="80px"
                  className={`object-cover transition-transform ${
                    isActive ? "" : "group-hover:scale-105"
                  }`}
                  unoptimized
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
