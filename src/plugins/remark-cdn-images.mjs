// src/plugins/remark-cdn-images.mjs
import { visit } from "unist-util-visit";

const CLOUDINARY_BASE = "https://res.cloudinary.com/tvphus/image/upload/";
const CDN_BASE = "https://cdn.tvphus.dev";

export function remarkCdnImages() {
  return (tree) => {
    visit(tree, "image", (node) => {
      if (node.url.startsWith(CLOUDINARY_BASE)) {
        let path = node.url.replace(CLOUDINARY_BASE, "");
        // Strip transform prefix, Worker tự thêm lại
        path = path.replace(/^(?:[a-z]+_[^/,]+(?:,[a-z]+_[^/,]+)*\/)+/, "");
        node.url = `${CDN_BASE}/image/optimized/${path}`;
      }
    });
  };
}