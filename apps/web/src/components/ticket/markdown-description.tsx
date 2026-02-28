import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

interface MarkdownDescriptionProps {
  value: string;
}

const proseClassName =
  "markdown-description min-w-0 text-sm leading-6 text-ink-100 [&_*]:min-w-0 [&_a]:text-ink-50 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-white/15 [&_blockquote]:pl-4 [&_blockquote]:text-ink-200 [&_code]:rounded-md [&_code]:bg-white/[0.06] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.92em] [&_h1]:m-0 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:m-0 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:m-0 [&_h3]:text-base [&_h3]:font-semibold [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-white/10 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-white/10 [&_img]:bg-black/20 [&_img]:shadow-sm [&_li>input]:mr-2 [&_ol]:m-0 [&_ol]:pl-6 [&_p]:m-0 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/30 [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_table]:w-full [&_table]:border-collapse [&_table]:overflow-hidden [&_table]:rounded-lg [&_tbody_td]:border-t [&_tbody_td]:border-white/10 [&_tbody_td]:px-3 [&_tbody_td]:py-2 [&_td]:align-top [&_th]:bg-white/[0.04] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_thead]:border-b [&_thead]:border-white/10 [&_ul]:m-0 [&_ul]:pl-6";

export function MarkdownDescription({ value }: MarkdownDescriptionProps) {
  return (
    <div className={proseClassName}>
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          img: ({ node: _node, ...props }) => <img {...props} loading="lazy" />
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
