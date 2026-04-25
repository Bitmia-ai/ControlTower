/**
 * MarkdownRenderer — thin wrapper around react-markdown + remark-gfm.
 *
 * This component is intentionally kept in its own file so it can be
 * dynamically imported via `next/dynamic` in client pages that use markdown.
 * Dynamic import moves react-markdown (~60 KB gzip) out of the shared chunk
 * and into a lazy route chunk that is only fetched when the component renders.
 *
 * Usage (in a 'use client' page):
 *   import dynamic from "next/dynamic";
 *   const MarkdownRenderer = dynamic(() => import("@/components/markdown-renderer"), {
 *     ssr: false,
 *     loading: () => <span className="animate-pulse text-muted">…</span>,
 *   });
 */
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  children: string;
  /** Wrapper class applied to the container div (not passed to ReactMarkdown — className was removed in react-markdown v10). */
  className?: string;
  components?: Components;
}

export default function MarkdownRenderer({
  children,
  className,
  components,
}: MarkdownRendererProps) {
  const inner = (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children}
    </ReactMarkdown>
  );
  // Wrap in a div only when a className is provided (avoids an extra DOM node
  // in the common case). react-markdown v10 removed the className prop.
  return className ? <div className={className}>{inner}</div> : inner;
}
